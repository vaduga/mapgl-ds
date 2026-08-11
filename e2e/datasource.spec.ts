import { expect, test } from '@grafana/plugin-e2e';

const PROVISIONING_FILE = 'datasources.yml';
const DATA_SOURCE_NAME = 'Mapgl Tempo DataFrames';

test('renders the datasource configuration editor', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
}) => {
  const dataSource = await readProvisionedDataSource({
    fileName: PROVISIONING_FILE,
    name: DATA_SOURCE_NAME,
  });
  const configPage = await createDataSourceConfigPage({ type: dataSource.type });

  await expect(configPage.ctx.page.getByRole('textbox', { name: /Tempo URL/ })).toBeVisible();
  await expect(configPage.ctx.page.getByText('Default limit', { exact: true })).toBeVisible();
});

test('renders the datasource query editor in Explore', async ({
  explorePage,
  readProvisionedDataSource,
}) => {
  const dataSource = await readProvisionedDataSource({
    fileName: PROVISIONING_FILE,
    name: DATA_SOURCE_NAME,
  });

  await explorePage.goto();
  await explorePage.datasource.set(dataSource.name);

  const queryEditor = explorePage.getQueryEditorRow('A');
  await expect(queryEditor.getByText('Trace ID', { exact: true })).toBeVisible();
  await expect(queryEditor.getByText('TraceQL', { exact: true })).toBeVisible();
});
