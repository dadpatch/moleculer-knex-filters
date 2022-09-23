"use strict";

const _ = require("lodash");
const Validator = require("fastest-validator");
const validator = new Validator({
  useNewCustomCheckerFunction: true,
});

module.exports = function filtersMixin(opts = {}) {
  const parseFilterObj = (ctx) => {
    if (!ctx.params.filter) return ctx;
    ctx.params.filter = ctx.params.filter || {};
    ctx.params.query = ctx.params.query || {};

    if (typeof ctx.params.filter === "string") {
      ctx.params.filter = JSON.parse(ctx.params.filter);
    }
    if (typeof ctx.params.query === "string") {
      ctx.params.query = JSON.parse(ctx.params.query);
    }

    const translateToQuery = (obj) => {
      const querySearch = [];
      Object.entries(obj).forEach(([key, value]) => {
        let field = ctx.service?.settings?.fields?.[key];
        if (typeof field === "string") field = validator.parseShortHand(field);

        if (field) {
          const typeOfField = field.type;

          let querySearch = {};
          const columnName = field.columnName || key;
          if (typeOfField === "string" && value && typeof value === "string") {
            querySearch[key] = {
              $raw: {
                condition: `${_.snakeCase(columnName)} ilike ?`,
                bindings: [`%${value}%`],
              },
            };
          } else if (value || typeof value === "boolean") {
            querySearch[key] = value;
          }

          if (Object.keys(querySearch).length && !field.virtual) {
            querySearch.push(querySearch);
          }
        }
      });

      return querySearch;
    };

    if (ctx.params.filter.$or) {
      const orQuery = translateToQuery(orBindings);
      delete ctx.params.filter.$or;
      ctx.params.query.$or = ctx.params.query.$or || [];
      ctx.params.query.$or.push(...orQuery);
    }

    const andQuery = translateToQuery(ctx.params.filter);
    ctx.params.query.$and = ctx.params.query.$and || [];
    ctx.params.query.$and.push(...andQuery);

    return ctx;
  };

  const beforeHooks = {
    list: parseFilterObj,
    count: parseFilterObj,
    find: parseFilterObj,
  };

  const schema = {
    merged(schema) {
      if (schema.hooks && schema.hooks.before) {
        Object.keys(beforeHooks).forEach((hook) => {
          const currentHooks = Array.isArray(beforeHooks[hook])
            ? beforeHooks[hook]
            : [beforeHooks[hook]];
          if (schema.hooks.before[hook]) {
            const previousHooks = Array.isArray(schema.hooks.before[hook])
              ? schema.hooks.before[hook]
              : [schema.hooks.before[hook]];
            schema.hooks.before[hook] = [...previousHooks, ...currentHooks];
          } else {
            schema.hooks.before[hook] = currentHooks;
          }
        });
      } else {
        schema.hooks = schema.hooks || {};
        schema.hooks.before = _.defaultsDeep(
          schema.hooks.before || {},
          beforeHooks
        );
      }
    },
  };

  return schema;
};
