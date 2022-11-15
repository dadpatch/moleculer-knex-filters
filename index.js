'use strict';

const _ = require('lodash');
const Validator = require('fastest-validator');
const validator = new Validator({
  useNewCustomCheckerFunction: true,
});

module.exports = function filtersMixin(opts = {}) {
  const schema = {
    merged(schema) {
      if (schema.methods.sanitizeParams) {
        const superSanitizeParams = schema.methods.sanitizeParams;
        schema.methods.sanitizeParams = function (params, opts) {
          params = superSanitizeParams(params, opts);

          if (!params.filter) return params;
          params.filter = params.filter || {};
          params.query = params.query || {};

          if (typeof params.filter === 'string') {
            params.filter = JSON.parse(params.filter);
          }

          const translateToQuery = (obj) => {
            const query = [];
            Object.entries(obj).forEach(([key, value]) => {
              let field = schema.settings?.fields?.[key];
              if (typeof field === 'string')
                field = validator.parseShortHand(field);

              if (field) {
                const typeOfField = field.type;

                let querySearch = {};
                const columnName = field.columnName || key;
                if (
                  typeOfField === 'string' &&
                  value &&
                  typeof value === 'string'
                ) {
                  querySearch[key] = {
                    $raw: {
                      condition: `${_.snakeCase(columnName)} ilike ?`,
                      bindings: [`%${value}%`],
                    },
                  };
                } else if (value || typeof value === 'boolean') {
                  querySearch[key] = value;
                }

                if (Object.keys(querySearch).length && !field.virtual) {
                  query.push(querySearch);
                }
              }
            });

            return query;
          };

          if (params.filter.$or) {
            const orQuery = translateToQuery(params.filter.$or);
            delete params.filter.$or;
            params.query.$or = params.query.$or || [];
            params.query.$or.push(...orQuery);
          }

          const andQuery = translateToQuery(params.filter);
          params.query.$and = params.query.$and || [];
          params.query.$and.push(...andQuery);

          return params;
        };
      }
    },
  };

  return schema;
};
