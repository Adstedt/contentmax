# Story 7.2: API Documentation & Developer Portal

## User Story
As a developer,
I want comprehensive API documentation and tools,
So that I can easily integrate with the ContentMax platform.

## Size & Priority
- **Size**: M (4 hours)
- **Priority**: P2 - Medium
- **Sprint**: 7
- **Dependencies**: API endpoints complete

## Description
Create comprehensive API documentation using OpenAPI/Swagger specification, implement interactive API explorer, provide SDKs, code examples, and developer tools for easy integration.

## Implementation Steps

1. **OpenAPI specification**
   ```yaml
   # api/openapi.yaml
   openapi: 3.1.0
   info:
     title: ContentMax API
     version: 1.0.0
     description: AI-powered content generation platform API
     contact:
       email: api@contentmax.app
     license:
       name: MIT
       url: https://opensource.org/licenses/MIT
   
   servers:
     - url: https://api.contentmax.app/v1
       description: Production server
     - url: https://staging-api.contentmax.app/v1
       description: Staging server
     - url: http://localhost:3000/api/v1
       description: Development server
   
   security:
     - BearerAuth: []
     - ApiKeyAuth: []
   
   paths:
     /content/generate:
       post:
         summary: Generate content
         description: Generate AI-powered content based on parameters
         operationId: generateContent
         tags:
           - Content Generation
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/GenerateContentRequest'
               examples:
                 product:
                   summary: Product page generation
                   value:
                     pageType: product
                     targetKeywords:
                       - wireless headphones
                       - bluetooth earbuds
                     components:
                       - hero
                       - features
                       - faq
                     language: en
                     brandVoice:
                       tone: professional
                       style: informative
         responses:
           '200':
             description: Content generated successfully
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/GeneratedContent'
           '400':
             $ref: '#/components/responses/BadRequest'
           '401':
             $ref: '#/components/responses/Unauthorized'
           '429':
             $ref: '#/components/responses/RateLimited'
         x-code-samples:
           - lang: JavaScript
             source: |
               const response = await fetch('https://api.contentmax.app/v1/content/generate', {
                 method: 'POST',
                 headers: {
                   'Authorization': 'Bearer YOUR_API_KEY',
                   'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({
                   pageType: 'product',
                   targetKeywords: ['wireless headphones'],
                   components: ['hero', 'features', 'faq'],
                   language: 'en'
                 })
               });
               const content = await response.json();
           - lang: Python
             source: |
               import requests
               
               response = requests.post(
                 'https://api.contentmax.app/v1/content/generate',
                 headers={
                   'Authorization': 'Bearer YOUR_API_KEY',
                   'Content-Type': 'application/json'
                 },
                 json={
                   'pageType': 'product',
                   'targetKeywords': ['wireless headphones'],
                   'components': ['hero', 'features', 'faq'],
                   'language': 'en'
                 }
               )
               content = response.json()
   
     /taxonomy/analyze:
       post:
         summary: Analyze website taxonomy
         description: Analyze and extract taxonomy from website sitemap
         operationId: analyzeTaxonomy
         tags:
           - Taxonomy
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   sitemapUrl:
                     type: string
                     format: uri
                   options:
                     type: object
                     properties:
                       maxDepth:
                         type: integer
                         default: 3
                       includeProducts:
                         type: boolean
                         default: true
         responses:
           '200':
             description: Taxonomy analyzed successfully
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/TaxonomyAnalysis'
   
     /content/{id}:
       get:
         summary: Get content by ID
         operationId: getContent
         tags:
           - Content
         parameters:
           - name: id
             in: path
             required: true
             schema:
               type: string
               format: uuid
         responses:
           '200':
             description: Content retrieved successfully
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/Content'
   
   components:
     securitySchemes:
       BearerAuth:
         type: http
         scheme: bearer
         bearerFormat: JWT
       ApiKeyAuth:
         type: apiKey
         in: header
         name: X-API-Key
   
     schemas:
       GenerateContentRequest:
         type: object
         required:
           - pageType
           - targetKeywords
         properties:
           pageType:
             type: string
             enum:
               - product
               - category
               - brand
               - inspire
               - engage
           targetKeywords:
             type: array
             items:
               type: string
             minItems: 1
             maxItems: 20
           components:
             type: array
             items:
               type: string
               enum:
                 - hero
                 - features
                 - faq
                 - testimonials
                 - comparison
           language:
             type: string
             default: en
             enum:
               - en
               - es
               - fr
               - de
               - it
               - pt
               - nl
               - pl
               - sv
               - no
           brandVoice:
             $ref: '#/components/schemas/BrandVoice'
   ```

2. **API documentation generator**
   ```typescript
   // lib/docs/api-doc-generator.ts
   import SwaggerUI from 'swagger-ui-react';
   import { OpenAPIV3 } from 'openapi-types';
   
   class APIDocGenerator {
     private spec: OpenAPIV3.Document;
     
     constructor() {
       this.spec = this.loadOpenAPISpec();
       this.enhanceWithExamples();
       this.addAuthenticationGuide();
     }
     
     generateHTML(): string {
       return `
         <!DOCTYPE html>
         <html>
           <head>
             <title>ContentMax API Documentation</title>
             <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css">
           </head>
           <body>
             <div id="swagger-ui"></div>
             <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
             <script>
               const ui = SwaggerUIBundle({
                 url: '/api/openapi.json',
                 dom_id: '#swagger-ui',
                 deepLinking: true,
                 presets: [
                   SwaggerUIBundle.presets.apis,
                   SwaggerUIBundle.SwaggerUIStandalonePreset
                 ],
                 plugins: [
                   SwaggerUIBundle.plugins.DownloadUrl
                 ],
                 layout: "StandaloneLayout",
                 tryItOutEnabled: true,
                 requestInterceptor: (request) => {
                   request.headers['X-API-Key'] = localStorage.getItem('apiKey');
                   return request;
                 }
               });
             </script>
           </body>
         </html>
       `;
     }
     
     generateMarkdown(): string {
       const md = [];
       
       md.push('# ContentMax API Documentation\n');
       md.push(`Version: ${this.spec.info.version}\n\n`);
       md.push('## Base URL\n');
       md.push(`\`${this.spec.servers?.[0].url}\`\n\n`);
       
       md.push('## Authentication\n');
       md.push(this.generateAuthSection());
       
       md.push('## Endpoints\n');
       for (const [path, pathItem] of Object.entries(this.spec.paths)) {
         md.push(this.generateEndpointDoc(path, pathItem));
       }
       
       md.push('## Models\n');
       for (const [name, schema] of Object.entries(this.spec.components?.schemas || {})) {
         md.push(this.generateSchemaDoc(name, schema));
       }
       
       return md.join('\n');
     }
     
     generateSDK(language: 'typescript' | 'python' | 'php'): string {
       switch (language) {
         case 'typescript':
           return this.generateTypeScriptSDK();
         case 'python':
           return this.generatePythonSDK();
         case 'php':
           return this.generatePHPSDK();
       }
     }
     
     private generateTypeScriptSDK(): string {
       const sdk = [];
       
       sdk.push('// ContentMax API SDK for TypeScript\n');
       sdk.push('import axios, { AxiosInstance } from "axios";\n\n');
       
       // Generate interfaces from schemas
       for (const [name, schema] of Object.entries(this.spec.components?.schemas || {})) {
         sdk.push(this.generateTypeScriptInterface(name, schema));
       }
       
       // Generate API client class
       sdk.push('export class ContentMaxClient {\n');
       sdk.push('  private client: AxiosInstance;\n\n');
       sdk.push('  constructor(apiKey: string, baseURL = "https://api.contentmax.app/v1") {\n');
       sdk.push('    this.client = axios.create({\n');
       sdk.push('      baseURL,\n');
       sdk.push('      headers: {\n');
       sdk.push('        "X-API-Key": apiKey,\n');
       sdk.push('        "Content-Type": "application/json"\n');
       sdk.push('      }\n');
       sdk.push('    });\n');
       sdk.push('  }\n\n');
       
       // Generate methods for each endpoint
       for (const [path, pathItem] of Object.entries(this.spec.paths)) {
         for (const [method, operation] of Object.entries(pathItem)) {
           if (['get', 'post', 'put', 'delete'].includes(method)) {
             sdk.push(this.generateTypeScriptMethod(path, method, operation));
           }
         }
       }
       
       sdk.push('}\n');
       
       return sdk.join('');
     }
   }
   ```

3. **Interactive API explorer**
   ```tsx
   // components/docs/APIExplorer.tsx
   const APIExplorer: React.FC = () => {
     const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
     const [apiKey, setApiKey] = useState('');
     const [requestBody, setRequestBody] = useState('');
     const [response, setResponse] = useState<any>(null);
     const [loading, setLoading] = useState(false);
     
     const executeRequest = async () => {
       if (!selectedEndpoint) return;
       
       setLoading(true);
       try {
         const result = await fetch(`/api${selectedEndpoint.path}`, {
           method: selectedEndpoint.method,
           headers: {
             'X-API-Key': apiKey,
             'Content-Type': 'application/json'
           },
           body: selectedEndpoint.method !== 'GET' ? requestBody : undefined
         });
         
         const data = await result.json();
         setResponse({
           status: result.status,
           headers: Object.fromEntries(result.headers.entries()),
           body: data
         });
       } catch (error) {
         setResponse({ error: error.message });
       } finally {
         setLoading(false);
       }
     };
     
     return (
       <div className="api-explorer">
         <div className="api-sidebar">
           <h3>Endpoints</h3>
           <EndpointList
             endpoints={endpoints}
             selectedEndpoint={selectedEndpoint}
             onSelectEndpoint={setSelectedEndpoint}
           />
         </div>
         
         <div className="api-main">
           {selectedEndpoint && (
             <>
               <EndpointDetails endpoint={selectedEndpoint} />
               
               <div className="api-credentials">
                 <label>API Key:</label>
                 <input
                   type="password"
                   value={apiKey}
                   onChange={(e) => setApiKey(e.target.value)}
                   placeholder="Enter your API key"
                 />
               </div>
               
               {selectedEndpoint.method !== 'GET' && (
                 <div className="request-body">
                   <h4>Request Body</h4>
                   <CodeEditor
                     value={requestBody}
                     onChange={setRequestBody}
                     language="json"
                     theme="vs-dark"
                   />
                   <button 
                     onClick={() => setRequestBody(selectedEndpoint.exampleRequest)}
                   >
                     Use Example
                   </button>
                 </div>
               )}
               
               <button 
                 onClick={executeRequest}
                 disabled={loading || !apiKey}
                 className="execute-btn"
               >
                 {loading ? 'Executing...' : `Execute ${selectedEndpoint.method}`}
               </button>
               
               {response && (
                 <div className="response-section">
                   <h4>Response</h4>
                   <div className="response-status">
                     Status: <span className={`status-${response.status}`}>
                       {response.status}
                     </span>
                   </div>
                   <CodeViewer
                     code={JSON.stringify(response.body, null, 2)}
                     language="json"
                   />
                 </div>
               )}
               
               <CodeExamples
                 endpoint={selectedEndpoint}
                 languages={['curl', 'javascript', 'python', 'php']}
               />
             </>
           )}
         </div>
       </div>
     );
   };
   ```

4. **SDK generators**
   ```typescript
   // lib/sdk/sdk-generator.ts
   class SDKGenerator {
     generateJavaScriptSDK(): string {
       return `
   /**
    * ContentMax JavaScript SDK
    * @version ${version}
    */
   class ContentMax {
     constructor(apiKey, options = {}) {
       this.apiKey = apiKey;
       this.baseURL = options.baseURL || 'https://api.contentmax.app/v1';
       this.timeout = options.timeout || 30000;
     }
   
     async request(endpoint, options = {}) {
       const url = \`\${this.baseURL}\${endpoint}\`;
       const response = await fetch(url, {
         ...options,
         headers: {
           'X-API-Key': this.apiKey,
           'Content-Type': 'application/json',
           ...options.headers
         },
         timeout: this.timeout
       });
   
       if (!response.ok) {
         throw new ContentMaxError(response.status, await response.text());
       }
   
       return response.json();
     }
   
     // Content Generation
     async generateContent(params) {
       return this.request('/content/generate', {
         method: 'POST',
         body: JSON.stringify(params)
       });
     }
   
     // Taxonomy
     async analyzeTaxonomy(sitemapUrl, options = {}) {
       return this.request('/taxonomy/analyze', {
         method: 'POST',
         body: JSON.stringify({ sitemapUrl, options })
       });
     }
   
     // Batch Operations
     async generateBatch(items) {
       return this.request('/content/generate/batch', {
         method: 'POST',
         body: JSON.stringify({ items })
       });
     }
   
     // Webhooks
     async createWebhook(url, events) {
       return this.request('/webhooks', {
         method: 'POST',
         body: JSON.stringify({ url, events })
       });
     }
   }
   
   // Error handling
   class ContentMaxError extends Error {
     constructor(status, message) {
       super(message);
       this.name = 'ContentMaxError';
       this.status = status;
     }
   }
   
   // Export for different environments
   if (typeof module !== 'undefined' && module.exports) {
     module.exports = ContentMax;
   } else if (typeof define === 'function' && define.amd) {
     define(() => ContentMax);
   } else {
     window.ContentMax = ContentMax;
   }
       `;
     }
     
     generatePythonSDK(): string {
       return `
   """
   ContentMax Python SDK
   Version: ${version}
   """
   import requests
   from typing import Dict, List, Optional, Any
   from urllib.parse import urljoin
   
   class ContentMax:
       """ContentMax API client for Python"""
       
       def __init__(self, api_key: str, base_url: str = "https://api.contentmax.app/v1"):
           self.api_key = api_key
           self.base_url = base_url
           self.session = requests.Session()
           self.session.headers.update({
               "X-API-Key": api_key,
               "Content-Type": "application/json"
           })
       
       def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
           """Make an API request"""
           url = urljoin(self.base_url, endpoint)
           response = self.session.request(method, url, **kwargs)
           response.raise_for_status()
           return response.json()
       
       def generate_content(
           self,
           page_type: str,
           target_keywords: List[str],
           components: Optional[List[str]] = None,
           language: str = "en",
           brand_voice: Optional[Dict] = None
       ) -> Dict[str, Any]:
           """Generate content using AI"""
           payload = {
               "pageType": page_type,
               "targetKeywords": target_keywords,
               "components": components or ["hero", "features", "faq"],
               "language": language,
               "brandVoice": brand_voice
           }
           return self._request("POST", "/content/generate", json=payload)
       
       def analyze_taxonomy(self, sitemap_url: str, **options) -> Dict[str, Any]:
           """Analyze website taxonomy from sitemap"""
           payload = {"sitemapUrl": sitemap_url, "options": options}
           return self._request("POST", "/taxonomy/analyze", json=payload)
       
       def get_content(self, content_id: str) -> Dict[str, Any]:
           """Retrieve content by ID"""
           return self._request("GET", f"/content/{content_id}")
       
       def generate_batch(self, items: List[Dict]) -> Dict[str, Any]:
           """Generate multiple content pieces in batch"""
           return self._request("POST", "/content/generate/batch", json={"items": items})
       `;
     }
   }
   ```

5. **Developer portal**
   ```tsx
   // pages/developers/index.tsx
   const DeveloperPortal: React.FC = () => {
     const [activeTab, setActiveTab] = useState('getting-started');
     
     return (
       <div className="developer-portal">
         <header className="portal-header">
           <h1>ContentMax Developer Portal</h1>
           <p>Build amazing content experiences with our API</p>
         </header>
         
         <nav className="portal-nav">
           <button 
             onClick={() => setActiveTab('getting-started')}
             className={activeTab === 'getting-started' ? 'active' : ''}
           >
             Getting Started
           </button>
           <button 
             onClick={() => setActiveTab('api-reference')}
             className={activeTab === 'api-reference' ? 'active' : ''}
           >
             API Reference
           </button>
           <button 
             onClick={() => setActiveTab('sdks')}
             className={activeTab === 'sdks' ? 'active' : ''}
           >
             SDKs & Libraries
           </button>
           <button 
             onClick={() => setActiveTab('examples')}
             className={activeTab === 'examples' ? 'active' : ''}
           >
             Examples
           </button>
           <button 
             onClick={() => setActiveTab('playground')}
             className={activeTab === 'playground' ? 'active' : ''}
           >
             API Playground
           </button>
         </nav>
         
         <div className="portal-content">
           {activeTab === 'getting-started' && <GettingStarted />}
           {activeTab === 'api-reference' && <APIReference />}
           {activeTab === 'sdks' && <SDKsLibraries />}
           {activeTab === 'examples' && <CodeExamples />}
           {activeTab === 'playground' && <APIPlayground />}
         </div>
         
         <aside className="portal-sidebar">
           <APIKeyManager />
           <RateLimitInfo />
           <WebhookManager />
           <SupportLinks />
         </aside>
       </div>
     );
   };
   ```

## Files to Create

- `api/openapi.yaml` - OpenAPI specification
- `lib/docs/api-doc-generator.ts` - Documentation generator
- `lib/sdk/sdk-generator.ts` - SDK generator
- `components/docs/APIExplorer.tsx` - API explorer component
- `components/docs/CodeExamples.tsx` - Code examples component
- `pages/developers/index.tsx` - Developer portal page
- `pages/api/v1/[...path].ts` - API routes handler
- `public/sdk/contentmax.js` - JavaScript SDK
- `public/sdk/contentmax.py` - Python SDK

## Documentation Sections

- Getting Started Guide
- Authentication & Authorization
- API Reference
- SDKs & Client Libraries
- Code Examples
- Webhooks
- Rate Limiting
- Error Handling
- Versioning
- Changelog

## Acceptance Criteria

- [ ] OpenAPI spec complete
- [ ] Interactive API explorer working
- [ ] SDKs generated for 3+ languages
- [ ] Code examples for all endpoints
- [ ] Authentication documentation
- [ ] Rate limiting documentation
- [ ] Webhook documentation
- [ ] Postman collection available

## Testing Requirements

- [ ] Test API documentation accuracy
- [ ] Test API explorer functionality
- [ ] Test SDK generation
- [ ] Test code examples
- [ ] Test authentication flows
- [ ] Test rate limiting
- [ ] Test webhook delivery
- [ ] Test error responses

## Definition of Done

- [ ] Code complete and committed
- [ ] API spec validated
- [ ] Documentation generated
- [ ] SDKs functional
- [ ] Examples working
- [ ] Developer portal live
- [ ] Tests passing
- [ ] External review completed