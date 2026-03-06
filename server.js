import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const META_API_VERSION = process.env.META_API_VERSION || 'v25.0';

if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
  console.error('Faltam variáveis META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID');
  process.exit(1);
}

const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

async function metaGet(path, params = {}) {
  const url = new URL(`${META_BASE_URL}${path}`);

  Object.entries({
    ...params,
    access_token: META_ACCESS_TOKEN
  }).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Erro Meta API: ${response.status} - ${JSON.stringify(data)}`
    );
  }

  return data;
}

function createServer() {
  const server = new McpServer({
    name: 'meta-ads-mcp',
    version: '1.0.0'
  });

  server.tool(
    'list_campaigns',
    'Lista campanhas da conta de anúncios',
    {
      limit: z.number().int().min(1).max(100).optional()
    },
    async ({ limit = 25 }) => {
      const data = await metaGet(`/${META_AD_ACCOUNT_ID}/campaigns`, {
        fields: 'id,name,status,objective,effective_status',
        limit
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.data ?? [], null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    'campaign_insights',
    'Busca métricas por campanha',
    {
      date_preset: z.string().optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional()
    },
    async ({ date_preset = 'last_7d', since, until, limit = 50 }) => {
      const params = {
        level: 'campaign',
        fields: [
          'campaign_id',
          'campaign_name',
          'spend',
          'impressions',
          'reach',
          'clicks',
          'ctr',
          'cpc',
          'cpm',
          'frequency',
          'actions',
          'cost_per_action_type'
        ].join(','),
        limit
      };

      if (since && until) {
        params.time_range = JSON.stringify({ since, until });
      } else {
        params.date_preset = date_preset;
      }

      const data = await metaGet(`/${META_AD_ACCOUNT_ID}/insights`, params);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.data ?? [], null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    'adset_insights',
    'Busca métricas por conjunto de anúncios',
    {
      date_preset: z.string().optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional()
    },
    async ({ date_preset = 'last_7d', since, until, limit = 50 }) => {
      const params = {
        level: 'adset',
        fields: [
          'campaign_name',
          'adset_id',
          'adset_name',
          'spend',
          'impressions',
          'reach',
          'clicks',
          'ctr',
          'cpc',
          'cpm',
          'frequency',
          'actions',
          'cost_per_action_type'
        ].join(','),
        limit
      };

      if (since && until) {
        params.time_range = JSON.stringify({ since, until });
      } else {
        params.date_preset = date_preset;
      }

      const data = await metaGet(`/${META_AD_ACCOUNT_ID}/insights`, params);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.data ?? [], null, 2)
          }
        ]
      };
    }
  );

  server.tool(
    'ad_insights',
    'Busca métricas por anúncio',
    {
      date_preset: z.string().optional(),
      since: z.string().optional(),
      until: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional()
    },
    async ({ date_preset = 'last_7d', since, until, limit = 50 }) => {
      const params = {
        level: 'ad',
        fields: [
          'campaign_name',
          'adset_name',
          'ad_id',
          'ad_name',
          'spend',
          'impressions',
          'reach',
          'clicks',
          'ctr',
          'cpc',
          'cpm',
          'frequency',
          'actions',
          'cost_per_action_type'
        ].join(','),
        limit
      };

      if (since && until) {
        params.time_range = JSON.stringify({ since, until });
      } else {
        params.date_preset = date_preset;
      }

      const data = await metaGet(`/${META_AD_ACCOUNT_ID}/insights`, params);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data.data ?? [], null, 2)
          }
        ]
      };
    }
  );

  return server;
}

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'meta-ads-mcp',
    message: 'Servidor online'
  });
});

app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || 'Erro interno no MCP'
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});