/* This file mirrors configuration scaffolded by @grafana/create-plugin. */

export const externals = [
  'lodash',
  'jquery',
  'moment',
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-redux',
  'redux',
  'rxjs',
  'i18next',
  'react-router',
  'd3',
  'angular',
  /^@grafana\/ui/i,
  /^@grafana\/runtime/i,
  /^@grafana\/data/i,
  ({ request }, callback) => {
    const prefix = 'grafana/';
    if (request?.startsWith(prefix)) {
      callback(undefined, request.slice(prefix.length));
      return;
    }

    callback();
  },
];
