import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { Extensions } from '@nestjs/graphql';
import { EagerContext, eagerLoad, EagerLoadClosure, flatRelations, RelationDefinitions } from '@sapientpro/typeorm-eager-load';
import {
  defaultFieldResolver,
  GraphQLNonNull,
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLSchema,
  isWrappingType,
  Kind,
  SelectionSetNode, StringValueNode,
} from 'graphql';

type Args = [Record<string, any>, any];
export function EagerLoad(passThrough: true): MethodDecorator & PropertyDecorator;
export function EagerLoad(constrain: EagerLoadClosure<Args>): MethodDecorator & PropertyDecorator
export function EagerLoad(relations?: RelationDefinitions<Args>): MethodDecorator & PropertyDecorator;
export function EagerLoad(eager?: RelationDefinitions<Args> | EagerLoadClosure<Args> | true): MethodDecorator & PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (eager instanceof Function) {
      eager = { [propertyKey]: eager };
    }
    Extensions({ eager: eager ?? [propertyKey] })(target, propertyKey);
  };
}

function addEagerLoad(objectType: GraphQLNonNull<any> | GraphQLNullableType, selectionSet: SelectionSetNode | undefined, eagerContext: EagerContext, context: any) {
  if (selectionSet?.kind !== Kind.SELECTION_SET) return;
  while (isWrappingType(objectType)) {
    objectType = objectType.ofType;
  }
  if (!(objectType instanceof GraphQLObjectType)) return;

  const relations: RelationDefinitions[] = [];
  const fields = objectType.getFields();
  selectionSet.selections.forEach((selection) => {
    if (selection.kind !== Kind.FIELD) return;
    if (!(selection.name.value in fields)) return;
    const field = fields[selection.name.value],
      eager = <RelationDefinitions<Args> | true | undefined>field.extensions.eager;
    if (!eager) return;

    const args: Record<string, any> = Object.fromEntries(
      selection.arguments?.map((arg) => [
        arg.name.value,
        arg.value.kind === Kind.VARIABLE ? context[arg.value.name.value] : (arg.value as StringValueNode).value,
      ]) ?? [],
    );
    if (eager === true) {
      addEagerLoad(field.type, selection.selectionSet, eagerContext, context);
    } else {
      Object.entries(flatRelations<Args>(eager)).forEach(([relation, constrain]) => {
        relations.push({
          [relation]: (qb, eagerContext) => {
            addEagerLoad(field.type, selection.selectionSet, eagerContext, context);
            constrain && constrain(qb, eagerContext, args, context);
          },
        });
      });
    }
  });

  if (relations.length) {
    eagerContext.loadWith(relations);
  }
}

export function eagerLoadSchemaTransformer(schema: GraphQLSchema) {
  return mapSchema(schema, {
    [MapperKind.QUERY_ROOT_FIELD]: (fieldConfig) => {
      const resolve = fieldConfig.resolve || defaultFieldResolver;
      fieldConfig.resolve = async function (source, args, context, info) {
        console.log(context);
        const value = await resolve(source, args, context, info);
        const eagerRelations: RelationDefinitions[] = [];
        addEagerLoad(fieldConfig.type, info.fieldNodes[0].selectionSet, {
          filter: () => void 0,
          lateral: () => void 0,
          loadWith: (relations) => {
            eagerRelations.push(relations);
          },
        }, context);
        if (eagerRelations.length) {
          await eagerLoad(value as object, eagerRelations);
        }
        return value;
      };
      return fieldConfig;
    },
  });
}
