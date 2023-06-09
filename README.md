Eager Loader for @nestjs/graphql
[![NPM Package](https://img.shields.io/npm/v/@sapientpro/nestjs-graphql-eager-load.svg)](https://www.npmjs.org/package/@sapientpro/nestjs-graphql-eager-load)
================

This package provides support for eager loading of relations in GraphQL queries, allowing you to significantly reduce the number of database queries required to fetch related data. With this package, you can easily define which relations should be eager-loaded for each GraphQL resolver, and the package takes care of the rest.

It utilises [@sapientpro/typeorm-eager-load](https://www.npmjs.com/package/@sapientpro/typeorm-eager-load) package to load relations. Please refer to the documentation of that package for more information.

## Installation

Install the package using npm:

```
npm install @sapientpro/nestjs-graphql-eager-load --save
```

Install the package using yarn:

```
yarn add @sapientpro/nestjs-graphql-eager-load
```

Configure graphql schema in your application:

```typescript
import { eagerLoadSchemaTransformer } from '@sapientpro/nestjs-graphql-eager-load';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      ...
      transformSchema: eagerLoadSchemaTransformer,
    }),
  ],
})
```

## Usage

Import the EagerLoad directive from the nestjs-graphql-eager-load package:

```typescript
import { EagerLoad } from '@sapientpro/nestjs-graphql-eager-load';
```
Then, use it to load entity relations:

```typescript
import { EagerLoad } from "@sapientpro/nestjs-graphql-eager-load";

@ObjectType()
class Article {
  @Field(() => [Comment])
  @EagerLoad()
  comments: Comment[];

  @ResolveField(() => [Tag])
  @EagerLoad(['tags'])
  tags(@Root() article: Article): TagEntity[] {
    return article.tags;
  }
}
```

### Relation Definition

You can also use a relation definition like in [@sapientpro/typeorm-eager-load](https://www.npmjs.com/package/@sapientpro/typeorm-eager-load) package. Please refer to the documentation of that package for more information.

```typescript
    @EagerLoad({
        comments: (builder) => {
          //some constraints
        }
    })
```

If you use only one relation that equals the field name you can specify only constraint function.

```typescript
@Field(() => [Comment])
@EagerLoad((builder) => {
  //some constraints
})
comments: Comment[];
```

### PassTrough

If you have a nested model with same entity you can specify passTrough option to pass the processing to the nested model.

```typescript
@EagerLoad(true)
@ResolveField(() => ArticleMeta)
meta(@Root() article: ArticleEntity): ArticleEntity {
  return article;
}
```

### Arguments

If you need to use arguments to load relations. You can use the third argument in your constraint function in this case.

```typescript
@EagerLoad({
  comments: (builder, {}, args) => {
    if(args.newerThan) {
      builder.where('comments.createdAt >= :date', {date: args.newerThan});
    }
  }
})
@ResolveFioeld(() => [Comment])
comments(@Root() article: Article, @Args() args: CommentsArgs): CommentEntity[] {
  return article.comments;
}
```

### GraphQL context

If you need to use context in your constraint function, you can use the fourth argument in your constraint function.

```typescript
@EagerLoad({
  comments: (builder, {}, args, context) => {
    if(args.onlyMyComments) {
    builder.where('comments.authorId = :userId', {userId: context.req.user.id});
      }
  }
})
@ResolveField(() => [Comment])
comments(@Root() article: Article, @Args() args: CommentsArgs): CommentEntity[] {
  return article.comments;
}
```

### EagerLoadEntry

If you have a field resolver that is not a query or mutation, you can mark it as LoadEagerEntry to enable eager load processing
    
```typescript
@EagerLoadEntry()
@ResolveField(() => [Comment])
comments(): CommentEntity[] {
  return commentsRepository.findAll();
}
```

also you can specify field to use as entity entry

```typescript
@EagerLoadEntry('nodes')
@ResolveField(() => PaginatedComment)
comments(): CommentEntity[] {
  return {
    nodes: commentsRepository.findAll()
  };
}
```


## Contributing

Contributions are welcome! If you have any bug reports, feature requests, or patches, please [open an issue](https://github.com/sapientpro/nestjs-graphql-eager-load/issues) or create a [pull request](https://github.com/sapientpro/nestjs-graphql-eager-load/pulls).

## License

This package is licensed under the [MIT License](https://github.com/sapientpro/nestjs-graphql-eager-load/blob/main/LICENSE).






