export const tabbedDashboardConfig = [
  {
    id: 'headcount',
    label: 'HeadCount (People Metric)',
    sections: [
      {
        id: 'headcount_summary',
        title: 'Headcount Summary',
        type: 'kpi',
        items: [
          { id: 'hc_kpi_1', title: 'Actual HC YTD', baseSQL: 'SELECT label, value FROM total_hc LIMIT 1' },
          { id: 'hc_kpi_2', title: 'Prior Year-End', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_3', title: 'Prior Month-End', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_4', title: 'Pending Start YTG', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_5', title: 'Total Open Reqs', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_6', title: 'New Hire YTD', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_7', title: 'Attrition YTD', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_8', title: 'New Transfer YTD', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' },
          { id: 'hc_kpi_9', title: 'New Add w/Transfer YTD', baseSQL: 'SELECT label, value FROM open_positions LIMIT 1' }
        ]
      },
      {
        id: 'headcount_graph',
        title: 'Headcount Trend',
        type: 'graph',
        baseSQL: 'SELECT month, count FROM headcount_trend'
      },
      {
        id: 'headcount_table',
        title: 'Headcount Detail',
        type: 'table',
        baseSQL: 'SELECT * FROM headcount_details'
      },
      {
        id: 'headcount_raw',
        title: 'Raw Headcount Data',
        type: 'table',
        baseSQL: 'SELECT * FROM headcount_raw'
      }
    ]
  },
  {
    id: 'hc',
    label: 'HeadCount (Roster)',
    sections: []
  },
  {
    id: 'imr',
    label: 'IMR',
    sections: []
  },
  {
    id: 'cognos',
    label: 'Cognos',
    sections: []
  }
];