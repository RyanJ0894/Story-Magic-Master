/**
 * OpenAPI 3.1 Specification for Story Magic API
 *
 * This file defines the complete API schema with types, validation,
 * and documentation that can be used for:
 * - Swagger UI documentation
 * - API client generation
 * - Request/response validation
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Story Magic API',
    version: '1.0.0',
    description: `
Story Magic is an AI-powered audio production platform that transforms screenplays
into immersive audio experiences. This API enables:

- **Writers**: Upload scripts, generate audio, share with industry readers
- **Readers**: Receive scripts, manage library, stream protected audio
- **Admin**: Manage users, subscriptions, and platform analytics

## Authentication
All endpoints require authentication via Supabase Auth. Include the session token
in the \`Authorization\` header as a Bearer token.

## Rate Limiting
- Standard endpoints: 100 requests/minute
- File upload: 10 requests/minute
- Audio streaming: 1000 requests/minute
    `,
    contact: {
      name: 'Story Magic Support',
      email: 'support@storymagic.ai',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'https://app.storymagic.ai',
      description: 'Production',
    },
    {
      url: 'http://localhost:22000',
      description: 'Local Development',
    },
  ],
  tags: [
    {
      name: 'Shares',
      description: 'Script sharing and access management',
    },
    {
      name: 'Reader Library',
      description: 'Reader script library and playback',
    },
    {
      name: 'Writer',
      description: 'Writer script management',
    },
    {
      name: 'Upload',
      description: 'File upload and processing',
    },
    {
      name: 'Admin',
      description: 'Platform administration (requires admin role)',
    },
  ],
  paths: {
    '/api/shares': {
      get: {
        tags: ['Shares'],
        summary: 'List all shares',
        description: 'Returns all share links created by the authenticated user',
        operationId: 'listShares',
        parameters: [
          {
            name: 'project_id',
            in: 'query',
            description: 'Filter shares by project ID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'List of shares',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    shares: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Share' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Shares'],
        summary: 'Create a share link',
        description: 'Creates a new share link for a project. Requires active subscription.',
        operationId: 'createShare',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateShareRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Share created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateShareResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/shares/{shareId}': {
      get: {
        tags: ['Shares'],
        summary: 'Get share details',
        operationId: 'getShare',
        parameters: [
          { $ref: '#/components/parameters/ShareId' },
        ],
        responses: {
          '200': {
            description: 'Share details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    share: { $ref: '#/components/schemas/Share' },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Shares'],
        summary: 'Update share settings',
        operationId: 'updateShare',
        parameters: [
          { $ref: '#/components/parameters/ShareId' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateShareRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Share updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    share: { $ref: '#/components/schemas/Share' },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Shares'],
        summary: 'Revoke share link',
        operationId: 'deleteShare',
        parameters: [
          { $ref: '#/components/parameters/ShareId' },
        ],
        responses: {
          '200': {
            description: 'Share revoked',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/shares/access/{code}': {
      get: {
        tags: ['Shares'],
        summary: 'Access shared content',
        description: 'Access a script via share code. Returns project details and audio stream URL.',
        operationId: 'accessShare',
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            description: 'Share code',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Share access granted',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShareAccessResponse' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '410': {
            description: 'Share expired or limit reached',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
      post: {
        tags: ['Shares'],
        summary: 'Verify password for protected share',
        operationId: 'verifySharePassword',
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Password verified',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShareAccessResponse' },
              },
            },
          },
          '401': {
            description: 'Incorrect password',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/reader/library': {
      get: {
        tags: ['Reader Library'],
        summary: 'Get reader library',
        description: 'Returns all scripts in the reader\'s library with subscription status',
        operationId: 'getLibrary',
        parameters: [
          {
            name: 'source',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['received', 'uploaded', 'purchased'],
            },
          },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['active', 'archived'],
            },
          },
          {
            name: 'favorited',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': {
            description: 'Library entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/LibraryEntryDetailed' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/reader/library/{entryId}': {
      get: {
        tags: ['Reader Library'],
        summary: 'Get library entry',
        operationId: 'getLibraryEntry',
        parameters: [
          { $ref: '#/components/parameters/EntryId' },
        ],
        responses: {
          '200': {
            description: 'Entry with audio details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LibraryEntryWithAudio' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Reader Library'],
        summary: 'Update library entry',
        operationId: 'updateLibraryEntry',
        parameters: [
          { $ref: '#/components/parameters/EntryId' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateLibraryEntryRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Entry updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entry: { $ref: '#/components/schemas/LibraryEntry' },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Reader Library'],
        summary: 'Remove from library',
        operationId: 'removeFromLibrary',
        parameters: [
          { $ref: '#/components/parameters/EntryId' },
        ],
        responses: {
          '200': {
            description: 'Entry removed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },
    '/api/reader/library/{entryId}/favorite': {
      post: {
        tags: ['Reader Library'],
        summary: 'Toggle favorite',
        operationId: 'toggleFavorite',
        parameters: [
          { $ref: '#/components/parameters/EntryId' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  is_favorited: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Favorite toggled',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entry: { $ref: '#/components/schemas/LibraryEntry' },
                    is_favorited: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/reader/library/{entryId}/position': {
      post: {
        tags: ['Reader Library'],
        summary: 'Update playback position',
        operationId: 'updatePosition',
        parameters: [
          { $ref: '#/components/parameters/EntryId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['position'],
                properties: {
                  position: {
                    type: 'number',
                    description: 'Playback position in seconds',
                  },
                  duration: {
                    type: 'number',
                    description: 'Total duration for completion detection',
                  },
                  completed: {
                    type: 'boolean',
                    description: 'Force mark as completed',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Position updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entry: { $ref: '#/components/schemas/LibraryEntry' },
                    position: { type: 'number' },
                    completed: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/reader/upload/create-payment': {
      post: {
        tags: ['Upload'],
        summary: 'Create payment for upload',
        operationId: 'createUploadPayment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['price', 'needsOCR'],
                properties: {
                  price: {
                    type: 'number',
                    enum: [5, 8],
                    description: '$5 for standard, $8 for OCR',
                  },
                  needsOCR: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment intent created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    clientSecret: { type: 'string' },
                    paymentIntentId: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/reader/upload/process': {
      post: {
        tags: ['Upload'],
        summary: 'Process uploaded PDF',
        operationId: 'processUpload',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'name'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PDF file to upload',
                  },
                  name: {
                    type: 'string',
                    description: 'Script name',
                  },
                  needsOCR: {
                    type: 'string',
                    enum: ['true', 'false'],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Processing started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projectId: { type: 'string', format: 'uuid' },
                    jobId: { type: 'string', format: 'uuid' },
                    status: { type: 'string', enum: ['processing'] },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
        },
      },
      Share: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          project_id: { type: 'string', format: 'uuid' },
          shared_by: { type: 'string', format: 'uuid' },
          share_code: { type: 'string' },
          access_level: { type: 'string', enum: ['stream', 'download'] },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          recipient_email: { type: 'string', format: 'email', nullable: true },
          recipient_name: { type: 'string', nullable: true },
          max_plays: { type: 'integer', nullable: true },
          view_count: { type: 'integer' },
          play_count: { type: 'integer' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateShareRequest: {
        type: 'object',
        required: ['project_id'],
        properties: {
          project_id: { type: 'string', format: 'uuid' },
          access_level: { type: 'string', enum: ['stream', 'download'], default: 'stream' },
          expires_at: { type: 'string', format: 'date-time' },
          recipient_email: { type: 'string', format: 'email' },
          recipient_name: { type: 'string' },
          max_plays: { type: 'integer', minimum: 1 },
          password: { type: 'string', minLength: 4 },
        },
      },
      CreateShareResponse: {
        type: 'object',
        properties: {
          share: { $ref: '#/components/schemas/Share' },
          shareUrl: { type: 'string', format: 'uri' },
          shareCode: { type: 'string' },
        },
      },
      UpdateShareRequest: {
        type: 'object',
        properties: {
          access_level: { type: 'string', enum: ['stream', 'download'] },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          is_active: { type: 'boolean' },
          recipient_email: { type: 'string', format: 'email' },
          recipient_name: { type: 'string' },
          max_plays: { type: 'integer', nullable: true },
          password: { type: 'string', nullable: true },
        },
      },
      ShareAccessResponse: {
        type: 'object',
        properties: {
          share: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              accessLevel: { type: 'string' },
              expiresAt: { type: 'string', nullable: true },
            },
          },
          project: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              pageCount: { type: 'integer' },
            },
          },
          writer: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              code: { type: 'string' },
            },
          },
          audio: {
            type: 'object',
            nullable: true,
            properties: {
              url: { type: 'string', format: 'uri' },
              duration: { type: 'number' },
              manifest: { type: 'object' },
            },
          },
          canDownload: { type: 'boolean' },
          requiresPassword: { type: 'boolean' },
        },
      },
      LibraryEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          reader_id: { type: 'string', format: 'uuid' },
          project_id: { type: 'string', format: 'uuid' },
          source: { type: 'string', enum: ['received', 'uploaded', 'purchased'] },
          share_id: { type: 'string', format: 'uuid', nullable: true },
          status: { type: 'string', enum: ['active', 'archived', 'removed'] },
          is_favorited: { type: 'boolean' },
          notes: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          last_played_at: { type: 'string', format: 'date-time', nullable: true },
          play_position_seconds: { type: 'integer' },
          completed: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      LibraryEntryDetailed: {
        allOf: [
          { $ref: '#/components/schemas/LibraryEntry' },
          {
            type: 'object',
            properties: {
              script_name: { type: 'string' },
              page_count: { type: 'integer' },
              writer_name: { type: 'string' },
              writer_code: { type: 'string' },
              writer_subscribed: { type: 'boolean' },
              duration_seconds: { type: 'number' },
            },
          },
        ],
      },
      LibraryEntryWithAudio: {
        type: 'object',
        properties: {
          entry: { $ref: '#/components/schemas/LibraryEntry' },
          audio: {
            type: 'object',
            nullable: true,
            properties: {
              file_url: { type: 'string', format: 'uri' },
              duration_seconds: { type: 'number' },
              manifest: { type: 'object' },
            },
          },
        },
      },
      UpdateLibraryEntryRequest: {
        type: 'object',
        properties: {
          notes: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          play_position_seconds: { type: 'integer' },
          completed: { type: 'boolean' },
        },
      },
    },
    parameters: {
      ShareId: {
        name: 'shareId',
        in: 'path',
        required: true,
        description: 'Share ID',
        schema: { type: 'string', format: 'uuid' },
      },
      EntryId: {
        name: 'entryId',
        in: 'path',
        required: true,
        description: 'Library entry ID',
        schema: { type: 'string', format: 'uuid' },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Unauthorized' },
          },
        },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Active subscription required' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Not found' },
          },
        },
      },
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase Auth JWT token',
      },
    },
  },
  security: [
    { bearerAuth: [] },
  ],
} as const;

export type OpenAPISpec = typeof openApiSpec;
