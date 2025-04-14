import {
    AthenaClient,
    StartQueryExecutionCommand,
    GetQueryExecutionCommand,
    GetQueryResultsCommand,
  } from '@aws-sdk/client-athena';
  
  const athena = new AthenaClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'YOUR_ACCESS_KEY_ID',
      secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    },
  });
  
  const waitForQuery = async (executionId) => {
    while (true) {
      const { QueryExecution } = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: executionId }));
      const state = QueryExecution.Status.State;
      if (state === 'SUCCEEDED') return;
      if (state === 'FAILED' || state === 'CANCELLED') throw new Error(`Query ${state}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  };
  
  const getQueryResults = async (executionId) => {
    const { ResultSet } = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: executionId }));
    const [header, ...rows] = ResultSet.Rows;
    const headers = header.Data.map((d) => d.VarCharValue);
    return rows.map((row) => {
      const values = row.Data.map((d) => d.VarCharValue || '');
      return Object.fromEntries(values.map((v, i) => [headers[i], v]));
    });
  };
  
  export const athenaService = async (query, boxId) => {
    console.log(`[SQL for ${boxId}] → ${query}`);
    const start = await athena.send(
      new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: { Database: 'your_athena_db' },
        ResultConfiguration: {
          OutputLocation: 's3://your-athena-results-bucket/',
        },
      })
    );
    await waitForQuery(start.QueryExecutionId);
    return await getQueryResults(start.QueryExecutionId);
  };
  
  export const queryBuilder = (baseSQL, filters) => {
    let query = baseSQL;
    const clauses = [];
  
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'All' || value.length === 0) return;
  
      if (Array.isArray(value)) {
        const values = value
          .map((v) => typeof v === 'object' ? v.value : v)
          .filter((v) => v !== 'All' && v !== '__select_all__');
  
        if (values.length > 0) {
          clauses.push(`${key} IN (${values.map((v) => `'${v}'`).join(', ')})`);
        }
      } else {
        if (typeof value === 'object' && value.value) {
          clauses.push(`${key} = '${value.value}'`);
        } else {
          clauses.push(`${key} = '${value}'`);
        }
      }
    });
  
    if (clauses.length) {
      query += baseSQL.toLowerCase().includes('where') ? ' AND ' : ' WHERE ';
      query += clauses.join(' AND ');
    }
  
    return query;  
  };