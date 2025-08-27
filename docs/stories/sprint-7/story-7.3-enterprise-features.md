# Story 7.3: Enterprise Features

## User Story
As an enterprise customer,
I want advanced enterprise features including SSO, custom domains, and SLA monitoring,
So that the platform meets our organization's security and compliance requirements.

## Size & Priority
- **Size**: L (8 hours)
- **Priority**: P2 - Medium
- **Sprint**: 7
- **Dependencies**: Task 7.1 (User management)

## Description
Implement enterprise-grade features including Single Sign-On (SSO), custom domains, Service Level Agreement (SLA) monitoring, advanced security controls, and compliance certifications support.

## Implementation Steps

1. **Single Sign-On (SSO) implementation**
   ```typescript
   // lib/auth/sso.ts
   import { Strategy as SamlStrategy } from 'passport-saml';
   import { OAuth2Strategy } from 'passport-oauth2';
   import jwt from 'jsonwebtoken';
   
   interface SSOConfig {
     provider: 'saml' | 'oauth2' | 'oidc' | 'azure-ad' | 'google-workspace';
     enabled: boolean;
     config: any;
     mapping: AttributeMapping;
   }
   
   class SSOManager {
     private providers = new Map<string, SSOProvider>();
     
     async configureSAML(organizationId: string, config: SAMLConfig) {
       const samlStrategy = new SamlStrategy({
         path: `/auth/saml/${organizationId}/callback`,
         entryPoint: config.entryPoint,
         issuer: config.issuer,
         cert: config.certificate,
         identifierFormat: config.identifierFormat,
         decryptionPvk: config.decryptionKey,
         privateCert: config.privateKey,
         validateInResponseTo: true,
         requestIdExpirationPeriodMs: 3600000,
         passReqToCallback: true,
         authnContext: ['urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'],
         forceAuthn: config.forceAuthentication || false,
         signatureAlgorithm: 'sha256'
       }, async (req, profile, done) => {
         try {
           const user = await this.processSSO(organizationId, 'saml', profile);
           done(null, user);
         } catch (error) {
           done(error);
         }
       });
       
       this.providers.set(`saml-${organizationId}`, {
         type: 'saml',
         strategy: samlStrategy,
         config
       });
       
       // Generate metadata
       const metadata = samlStrategy.generateServiceProviderMetadata(
         config.decryptionKey,
         config.privateKey
       );
       
       await this.saveMetadata(organizationId, metadata);
       
       return {
         success: true,
         metadataUrl: `/auth/saml/${organizationId}/metadata`
       };
     }
     
     async configureOAuth2(organizationId: string, config: OAuth2Config) {
       const oauth2Strategy = new OAuth2Strategy({
         authorizationURL: config.authorizationURL,
         tokenURL: config.tokenURL,
         clientID: config.clientID,
         clientSecret: config.clientSecret,
         callbackURL: `/auth/oauth2/${organizationId}/callback`,
         scope: config.scope,
         state: true,
         pkce: true
       }, async (accessToken, refreshToken, profile, done) => {
         try {
           const user = await this.processSSO(organizationId, 'oauth2', profile);
           done(null, user);
         } catch (error) {
           done(error);
         }
       });
       
       this.providers.set(`oauth2-${organizationId}`, {
         type: 'oauth2',
         strategy: oauth2Strategy,
         config
       });
     }
     
     async configureAzureAD(organizationId: string, config: AzureADConfig) {
       const azureStrategy = new AzureADStrategy({
         tenantId: config.tenantId,
         clientId: config.clientId,
         clientSecret: config.clientSecret,
         redirectUri: `/auth/azure/${organizationId}/callback`,
         resource: 'https://graph.microsoft.com',
         responseType: 'code',
         responseMode: 'form_post',
         scope: ['user.read', 'profile', 'email', 'openid'],
         useCookieInsteadOfSession: false,
         passReqToCallback: true
       }, async (req, iss, sub, profile, accessToken, refreshToken, done) => {
         try {
           const user = await this.processSSO(organizationId, 'azure-ad', profile);
           done(null, user);
         } catch (error) {
           done(error);
         }
       });
       
       this.providers.set(`azure-${organizationId}`, {
         type: 'azure-ad',
         strategy: azureStrategy,
         config
       });
     }
     
     private async processSSO(
       organizationId: string,
       provider: string,
       profile: any
     ): Promise<User> {
       // Map external attributes to user
       const mapping = await this.getAttributeMapping(organizationId);
       const userData = this.mapAttributes(profile, mapping);
       
       // Check if user exists
       let user = await this.findUserByEmail(userData.email);
       
       if (!user) {
         // Auto-provision user
         if (await this.isAutoProvisioningEnabled(organizationId)) {
           user = await this.provisionUser(organizationId, userData);
         } else {
           throw new Error('User not found and auto-provisioning disabled');
         }
       }
       
       // Update user attributes
       await this.syncUserAttributes(user.id, userData);
       
       // Assign groups/roles
       if (profile.groups) {
         await this.syncGroups(user.id, profile.groups);
       }
       
       // Audit log
       await this.auditSSO({
         userId: user.id,
         organizationId,
         provider,
         success: true,
         timestamp: new Date()
       });
       
       return user;
     }
     
     async generateSSOToken(user: User, organizationId: string): Promise<string> {
       const payload = {
         sub: user.id,
         email: user.email,
         org: organizationId,
         roles: user.roles,
         sso: true,
         exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
       };
       
       return jwt.sign(payload, process.env.JWT_SECRET!);
     }
   }
   ```

2. **Custom domain management**
   ```typescript
   // lib/enterprise/custom-domains.ts
   class CustomDomainManager {
     async addCustomDomain(
       organizationId: string,
       domain: string
     ): Promise<CustomDomainResult> {
       // Validate domain format
       if (!this.isValidDomain(domain)) {
         throw new Error('Invalid domain format');
       }
       
       // Check domain availability
       if (await this.isDomainInUse(domain)) {
         throw new Error('Domain already in use');
       }
       
       // Generate verification code
       const verificationCode = this.generateVerificationCode();
       
       // Create domain record
       const domainRecord = await this.createDomainRecord({
         organizationId,
         domain,
         verificationCode,
         status: 'pending_verification',
         createdAt: new Date()
       });
       
       // Generate SSL certificate
       await this.requestSSLCertificate(domain);
       
       return {
         domain,
         verificationMethod: 'dns',
         verificationRecords: [
           {
             type: 'TXT',
             name: `_contentmax-verify.${domain}`,
             value: verificationCode
           },
           {
             type: 'CNAME',
             name: domain,
             value: 'custom.contentmax.app'
           }
         ],
         status: 'pending_verification'
       };
     }
     
     async verifyDomain(domain: string): Promise<boolean> {
       const record = await this.getDomainRecord(domain);
       
       // Check DNS records
       const dnsVerified = await this.verifyDNSRecords(domain, record.verificationCode);
       
       if (dnsVerified) {
         // Update status
         await this.updateDomainStatus(domain, 'verified');
         
         // Configure routing
         await this.configureRouting(domain, record.organizationId);
         
         // Setup SSL
         await this.setupSSL(domain);
         
         return true;
       }
       
       return false;
     }
     
     private async requestSSLCertificate(domain: string) {
       // Use Let's Encrypt via Cloudflare
       const response = await fetch('https://api.cloudflare.com/client/v4/zones/ssl/certificate_packs', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           type: 'dedicated',
           hosts: [domain, `www.${domain}`],
           validation_method: 'txt',
           certificate_authority: 'lets_encrypt'
         })
       });
       
       return response.json();
     }
     
     private async configureRouting(domain: string, organizationId: string) {
       // Add to Vercel configuration
       await this.updateVercelConfig({
         domains: [
           {
             domain,
             target: 'production',
             redirect: null
           }
         ],
         rewrites: [
           {
             source: '/:path*',
             destination: `/${organizationId}/:path*`,
             has: [
               {
                 type: 'host',
                 value: domain
               }
             ]
           }
         ]
       });
     }
   }
   ```

3. **SLA monitoring**
   ```typescript
   // lib/enterprise/sla-monitor.ts
   interface SLA {
     id: string;
     organizationId: string;
     metrics: SLAMetrics;
     thresholds: SLAThresholds;
     penalties: SLAPenalties;
   }
   
   interface SLAMetrics {
     uptime: number;           // 99.9%
     responseTime: number;     // p95 < 1000ms
     errorRate: number;        // < 0.1%
     supportResponseTime: number; // < 4 hours
   }
   
   class SLAMonitor {
     private slas = new Map<string, SLA>();
     private metrics = new Map<string, MetricHistory>();
     
     async monitorSLA(organizationId: string) {
       const sla = await this.getSLA(organizationId);
       
       // Collect current metrics
       const currentMetrics = await this.collectMetrics(organizationId);
       
       // Check violations
       const violations = this.checkViolations(sla, currentMetrics);
       
       if (violations.length > 0) {
         await this.handleViolations(organizationId, violations);
       }
       
       // Store metrics
       await this.storeMetrics(organizationId, currentMetrics);
       
       // Generate report
       return this.generateSLAReport(organizationId, currentMetrics, violations);
     }
     
     private async collectMetrics(organizationId: string): Promise<SLAMetrics> {
       const [uptime, responseTime, errorRate, supportTime] = await Promise.all([
         this.calculateUptime(organizationId),
         this.calculateResponseTime(organizationId),
         this.calculateErrorRate(organizationId),
         this.calculateSupportResponseTime(organizationId)
       ]);
       
       return {
         uptime,
         responseTime,
         errorRate,
         supportResponseTime: supportTime
       };
     }
     
     private checkViolations(sla: SLA, metrics: SLAMetrics): SLAViolation[] {
       const violations: SLAViolation[] = [];
       
       if (metrics.uptime < sla.thresholds.uptime) {
         violations.push({
           type: 'uptime',
           threshold: sla.thresholds.uptime,
           actual: metrics.uptime,
           severity: 'critical'
         });
       }
       
       if (metrics.responseTime > sla.thresholds.responseTime) {
         violations.push({
           type: 'responseTime',
           threshold: sla.thresholds.responseTime,
           actual: metrics.responseTime,
           severity: 'warning'
         });
       }
       
       if (metrics.errorRate > sla.thresholds.errorRate) {
         violations.push({
           type: 'errorRate',
           threshold: sla.thresholds.errorRate,
           actual: metrics.errorRate,
           severity: 'warning'
         });
       }
       
       return violations;
     }
     
     private async handleViolations(
       organizationId: string,
       violations: SLAViolation[]
     ) {
       // Calculate credits
       const credits = this.calculateCredits(violations);
       
       if (credits > 0) {
         await this.issueCredits(organizationId, credits);
       }
       
       // Notify stakeholders
       await this.notifyViolations(organizationId, violations, credits);
       
       // Escalate if needed
       if (violations.some(v => v.severity === 'critical')) {
         await this.escalateViolation(organizationId, violations);
       }
     }
     
     async generateSLAReport(
       organizationId: string,
       period: 'daily' | 'weekly' | 'monthly'
     ): Promise<SLAReport> {
       const metrics = await this.getMetricsHistory(organizationId, period);
       
       return {
         organizationId,
         period,
         summary: {
           uptime: this.calculateAverage(metrics.uptime),
           responseTime: this.calculateP95(metrics.responseTime),
           errorRate: this.calculateAverage(metrics.errorRate),
           violations: metrics.violations.length,
           credits: metrics.creditsIssued
         },
         details: {
           uptimeHistory: metrics.uptime,
           responseTimeHistory: metrics.responseTime,
           errorRateHistory: metrics.errorRate,
           incidents: metrics.incidents
         },
         compliance: {
           meetsSLA: metrics.violations.length === 0,
           uptimeCompliance: this.calculateCompliance(metrics.uptime, sla.thresholds.uptime),
           responseTimeCompliance: this.calculateCompliance(metrics.responseTime, sla.thresholds.responseTime),
           errorRateCompliance: this.calculateCompliance(metrics.errorRate, sla.thresholds.errorRate)
         }
       };
     }
   }
   ```

4. **Advanced security controls**
   ```typescript
   // lib/enterprise/security-controls.ts
   class EnterpriseSecurityControls {
     // IP whitelisting
     async configureIPWhitelist(
       organizationId: string,
       ipRanges: string[]
     ) {
       // Validate IP ranges
       const validatedRanges = ipRanges.map(range => {
         if (!this.isValidIPRange(range)) {
           throw new Error(`Invalid IP range: ${range}`);
         }
         return this.normalizeIPRange(range);
       });
       
       // Store configuration
       await this.saveIPWhitelist(organizationId, validatedRanges);
       
       // Update firewall rules
       await this.updateFirewallRules(organizationId, validatedRanges);
       
       return {
         success: true,
         ipRanges: validatedRanges
       };
     }
     
     // Data residency controls
     async configureDataResidency(
       organizationId: string,
       regions: string[]
     ) {
       const supportedRegions = ['us-east', 'us-west', 'eu-west', 'ap-southeast'];
       
       // Validate regions
       for (const region of regions) {
         if (!supportedRegions.includes(region)) {
           throw new Error(`Unsupported region: ${region}`);
         }
       }
       
       // Configure data storage
       await this.configureStorageRegions(organizationId, regions);
       
       // Configure processing regions
       await this.configureProcessingRegions(organizationId, regions);
       
       return {
         success: true,
         regions,
         primaryRegion: regions[0],
         replicationRegions: regions.slice(1)
       };
     }
     
     // Encryption key management
     async configureCustomEncryption(
       organizationId: string,
       config: EncryptionConfig
     ) {
       if (config.type === 'bring-your-own-key') {
         // Validate customer key
         await this.validateCustomerKey(config.keyId);
         
         // Configure KMS
         await this.configureKMS(organizationId, {
           provider: config.kmsProvider,
           keyId: config.keyId,
           region: config.region
         });
       }
       
       // Update encryption settings
       await this.updateEncryptionSettings(organizationId, {
         encryptionType: config.type,
         algorithm: config.algorithm || 'AES-256-GCM',
         keyRotation: config.keyRotation || 90 // days
       });
       
       // Re-encrypt existing data
       if (config.reencryptExisting) {
         await this.scheduleReencryption(organizationId);
       }
       
       return {
         success: true,
         encryptionType: config.type,
         keyId: config.keyId
       };
     }
     
     // Advanced audit logging
     async configureAuditLogging(
       organizationId: string,
       config: AuditConfig
     ) {
       return {
         logLevel: config.logLevel || 'info',
         retention: config.retentionDays || 365,
         exportDestination: config.exportDestination,
         realTimeStreaming: config.realTimeStreaming,
         includeReadOperations: config.includeReadOperations || false,
         includeSystemEvents: config.includeSystemEvents || true
       };
     }
   }
   ```

5. **Enterprise dashboard**
   ```tsx
   // components/enterprise/EnterpriseDashboard.tsx
   const EnterpriseDashboard: React.FC = () => {
     const [organization, setOrganization] = useState<Organization>();
     const [slaMetrics, setSLAMetrics] = useState<SLAMetrics>();
     const [securityStatus, setSecurityStatus] = useState<SecurityStatus>();
     
     return (
       <div className="enterprise-dashboard">
         <header className="enterprise-header">
           <h1>{organization?.name} Enterprise Dashboard</h1>
           <div className="enterprise-badges">
             {organization?.certifications?.map(cert => (
               <CertificationBadge key={cert} certification={cert} />
             ))}
           </div>
         </header>
         
         <div className="enterprise-metrics">
           <SLAWidget
             metrics={slaMetrics}
             compliance={slaMetrics?.compliance}
             violations={slaMetrics?.violations}
           />
           
           <SecurityWidget
             status={securityStatus}
             threats={securityStatus?.threats}
             compliance={securityStatus?.compliance}
           />
           
           <UsageWidget
             usage={organization?.usage}
             limits={organization?.limits}
             projections={organization?.projections}
           />
           
           <CostWidget
             currentSpend={organization?.billing?.currentSpend}
             projectedSpend={organization?.billing?.projectedSpend}
             credits={organization?.billing?.credits}
           />
         </div>
         
         <div className="enterprise-sections">
           <SSOConfiguration
             providers={organization?.ssoProviders}
             onConfigure={(provider, config) => configureSSOProvider(provider, config)}
           />
           
           <CustomDomainManager
             domains={organization?.customDomains}
             onAddDomain={(domain) => addCustomDomain(domain)}
             onVerifyDomain={(domain) => verifyDomain(domain)}
           />
           
           <SecurityControls
             ipWhitelist={organization?.security?.ipWhitelist}
             dataResidency={organization?.security?.dataResidency}
             encryption={organization?.security?.encryption}
             onUpdate={(controls) => updateSecurityControls(controls)}
           />
           
           <ComplianceCenter
             standards={['SOC2', 'GDPR', 'HIPAA', 'ISO27001']}
             currentCompliance={organization?.compliance}
             onGenerateReport={(standard) => generateComplianceReport(standard)}
           />
         </div>
         
         <EnterpriseSupport
           tier={organization?.supportTier}
           slaResponseTime={organization?.sla?.supportResponseTime}
           dedicatedManager={organization?.dedicatedAccountManager}
         />
       </div>
     );
   };
   ```

## Files to Create

- `lib/auth/sso.ts` - SSO implementation
- `lib/enterprise/custom-domains.ts` - Custom domain management
- `lib/enterprise/sla-monitor.ts` - SLA monitoring
- `lib/enterprise/security-controls.ts` - Security controls
- `lib/enterprise/compliance.ts` - Compliance management
- `components/enterprise/EnterpriseDashboard.tsx` - Enterprise dashboard
- `components/enterprise/SSOConfiguration.tsx` - SSO configuration UI
- `components/enterprise/ComplianceCenter.tsx` - Compliance UI
- `pages/enterprise/dashboard.tsx` - Enterprise dashboard page

## Enterprise Features

- **SSO Support**: SAML 2.0, OAuth 2.0, OpenID Connect, Azure AD, Google Workspace
- **Custom Domains**: Full white-label support with SSL
- **SLA Monitoring**: 99.9% uptime guarantee with automatic credits
- **Security Controls**: IP whitelisting, data residency, custom encryption
- **Compliance**: SOC 2, GDPR, HIPAA, ISO 27001
- **Advanced Support**: Dedicated account manager, priority support
- **Custom Contracts**: Volume discounts, custom terms

## Acceptance Criteria

- [ ] SSO implementation working
- [ ] Custom domains functional
- [ ] SLA monitoring active
- [ ] Security controls implemented
- [ ] Compliance reports available
- [ ] Enterprise dashboard complete
- [ ] Dedicated support channels
- [ ] Custom billing options

## Testing Requirements

- [ ] Test SSO with multiple providers
- [ ] Test custom domain setup
- [ ] Test SLA calculations
- [ ] Test security controls
- [ ] Test compliance reporting
- [ ] Load test enterprise features
- [ ] Security audit completed
- [ ] Compliance audit passed

## Definition of Done

- [ ] Code complete and committed
- [ ] SSO working with 3+ providers
- [ ] Custom domains verified
- [ ] SLA monitoring operational
- [ ] Security controls active
- [ ] Compliance documented
- [ ] Tests written and passing
- [ ] Enterprise documentation complete