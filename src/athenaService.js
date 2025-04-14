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
    let query = baseSQL.trim();
  
    // Extract and remove LIMIT if present
    const limitMatch = query.match(/limit\s+\d+/i);
    let limitClause = '';
    if (limitMatch) {
      limitClause = limitMatch[0];
      query = query.replace(limitMatch[0], '').trim(); // Remove limit from original position
    }
  
    // Prepare filter clauses
    const clauses = [];
  
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'All' || value.length === 0) return;
  
      if (Array.isArray(value)) {
        const values = value
          .map((v) => (typeof v === 'object' ? v.value : v))
          .filter((v) => v !== 'All' && v !== '__select_all__');
  
        if (values.length > 0) {
          clauses.push(`${key} IN (${values.map((v) => `'${v}'`).join(', ')})`);
        }
      } else {
        const val = typeof value === 'object' && value.value ? value.value : value;
        clauses.push(`${key} = '${val}'`);
      }
    });
  
    // Inject filters either in WHERE or HAVING clause
    if (clauses.length > 0) {
      const lowerSQL = query.toLowerCase();
      const clauseStr = clauses.join(' AND ');
  
      if (lowerSQL.includes('group by')) {
        query += lowerSQL.includes('having') ? ' AND ' : ' HAVING ';
      } else {
        query += lowerSQL.includes('where') ? ' AND ' : ' WHERE ';
      }
  
      query += clauseStr;
    }
  
    // Append LIMIT at the end
    if (limitClause) {
      query += ` ${limitClause}`;
    }
  
    return query;
  };
  