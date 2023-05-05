import { MapperKind, mapSchema } from '@graphql-tools/utils';
import { Extensions } from '@nestjs/graphql';
import {
  EagerContext,
  eagerLoad,
  EagerLoadClosure,
  flatRelations,
  RelationDefinitions
} from '@sapientpro/typeorm-eager-load';
import {
  defaultFieldResolver,
  getArgumentValues,
  GraphQLFieldConfig,
  GraphQLNonNull,
  GraphQLNullableType,
  GraphQLObjectType,
  GraphQLSchema,
  isWrappingType,
  Kind,
  SelectionSetNode,
} from 'graphql';

type Args = [Record<string, any>, any];

export function EagerLoad(passThrough: true): MethodDecorator & PropertyDecorator;
export function EagerLoad(constrain: EagerLoadClosure<Args>): MethodDecorator & PropertyDecorator
export function EagerLoad(relations?: RelationDefinitions<Args>): MethodDecorator & PropertyDecorator;
export function EagerLoad(eager?: RelationDefinitions<Args> | EagerLoadClosure<Args> | true): MethodDecorator & PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    if (eager instanceof Function) {
      eager = {[propertyKey]: eager};
    }
    Extensions({eager: eager ?? [propertyKey]})(target, propertyKey);
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
    const args = getArgumentValues(field, selection, context.variableValues);
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

function schemaTransformer(fieldConfig: GraphQLFieldConfig<any, any>) {
  const resolve = fieldConfig.resolve || defaultFieldResolver;
  fieldConfig.resolve = async function (source, args, context, info) {
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
}

export function eagerLoadSchemaTransformer(schema: GraphQLSchema) {
  return mapSchema(schema, {
    [MapperKind.MUTATION_ROOT_FIELD]: schemaTransformer,
    [MapperKind.QUERY_ROOT_FIELD]: schemaTransformer,
  });
}
