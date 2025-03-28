# Cost Analytics in Atlas

Atlas provides a Cost Analytics feature that allows administrators to monitor and analyze OpenAI API usage and costs across the platform. This documentation explains how to use the Cost Analytics feature and how it works behind the scenes.

## Accessing Cost Analytics

The Cost Analytics feature is accessible from the Insights page. To access it:

1. Log in as an administrator
2. Navigate to the Insights page
3. Click on the "Cost Analytics" tab

## Features

### Cost Overview

The Cost Analytics dashboard provides a quick overview of your OpenAI API costs:

- **Completions**: Total cost of chat completions and text generation
- **Embeddings**: Total cost of embedding generation
- **Vector Stores**: Total cost of vector storage
- **Total Cost**: Sum of all OpenAI API costs for the selected period

### Date Range Selection

You can analyze costs for a specific time period by using the date range selector at the top of the page. This allows you to:

- View costs for specific time periods
- Compare costs across different time frames
- Track spending trends over time

### Daily Cost Trends

The Cost Analytics dashboard includes a chart that shows daily cost trends for:

- Completions
- Embeddings
- Vector Stores

This visualization helps you identify:
- Days with unusually high usage
- Usage patterns over time
- Distribution of costs across different API features

## Technical Implementation

### Current Implementation

The current implementation uses simulated data to demonstrate the Cost Analytics feature's capabilities. This approach was chosen because:

1. The OpenAI Usage API requires special organization-level permissions
2. Many OpenAI accounts do not have access to the Usage API by default
3. Using simulated data allows for development and testing without requiring API access

The simulated data realistically models typical usage patterns, including:
- Reduced usage on weekends
- Variations between different services
- Gradual usage trends over time

### OpenAI Usage API (Production Implementation)

For organizations with access to the OpenAI Usage API, the implementation can be switched to use actual usage data by modifying the backend code to use the commented API calls. The OpenAI Usage API requires a date parameter to retrieve usage for a specific day:

```
GET https://api.openai.com/v1/usage?date=YYYY-MM-DD
```

When using the real API, the implementation would:
1. Query each day in the selected date range individually
2. Aggregate the results for the entire period
3. Process and categorize the usage by service type

### Data Processing

The usage data (whether simulated or from the API) is processed to:

1. Calculate total costs for each category
2. Organize daily usage metrics
3. Generate visualizations for trend analysis

### Security and Access Control

The Cost Analytics feature is only accessible to administrators. The backend API routes implement:

- Authentication checks using NextAuth.js
- Role-based access control for admin-only features

## Future Enhancements

Future enhancements planned for the Cost Analytics feature include:

1. Integration with the actual OpenAI Usage API for organizations with access
2. Project-level cost tracking and allocation
3. Token usage metrics by message and conversation
4. Cost forecasting and budget tools
5. Cost optimization recommendations

## Troubleshooting

If you encounter issues with the Cost Analytics feature:

1. Remember that the current implementation uses simulated data
2. For real API implementation, ensure your OpenAI API key is valid and properly configured
3. Verify you have administrator access to view the analytics
4. Check the browser console for any error messages
5. For OpenAI Usage API integration, ensure your OpenAI account has the required organization-level access to usage data 