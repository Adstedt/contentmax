-- Seed data for ContentMax development and testing

-- Insert sample organization
INSERT INTO organizations (id, name, slug, settings)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Demo Company', 'demo-company', 
   '{"theme": "default", "features": {"ai_generation": true, "bulk_operations": true}}');

-- Insert sample users (IDs will be created in auth.users first via Supabase Auth)
-- This is just the extended profile data
INSERT INTO users (id, email, full_name, organization_id, role)
VALUES 
  ('d0d4a9e0-7e3f-4d3a-8c6b-2e8c9f012345', 'admin@demo.com', 'Admin User', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin'),
  ('e1e5b0f1-8f4g-5e4b-9d7c-3f9d0g123456', 'editor@demo.com', 'Editor User', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'editor'),
  ('f2f6c1g2-9g5h-6f5c-ae8d-4g0e1h234567', 'viewer@demo.com', 'Viewer User', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'viewer')
ON CONFLICT (id) DO UPDATE
SET 
  organization_id = EXCLUDED.organization_id,
  role = EXCLUDED.role;

-- Insert sample project
INSERT INTO projects (id, organization_id, name, domain, description, settings)
VALUES 
  ('b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 
   'E-commerce Site', 'example-shop.com', 'Main e-commerce website for Demo Company',
   '{"languages": ["en", "es"], "content_types": ["brand", "category", "inspire", "engage"]}');

-- Insert sample taxonomy nodes
INSERT INTO taxonomy_nodes (id, project_id, parent_id, url, path, title, content_status, sku_count, depth, position)
VALUES 
  -- Root categories
  ('c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NULL, 
   '/electronics', '/electronics', 'Electronics', 'optimized', 450, 0, 0),
  ('d3hhef22-2f3e-7hi1-ee9g-9ee2eg613d44', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NULL, 
   '/clothing', '/clothing', 'Clothing', 'outdated', 320, 0, 1),
  ('e4iifg33-3g4f-8ij2-ff0h-0ff3fh724e55', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', NULL, 
   '/home-garden', '/home-garden', 'Home & Garden', 'missing', 280, 0, 2),
  
  -- Electronics subcategories
  ('f5jjgh44-4h5g-9jk3-gg1i-1gg4gi835f66', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
   '/electronics/computers', '/electronics/computers', 'Computers', 'optimized', 120, 1, 0),
  ('g6kkhi55-5i6h-0kl4-hh2j-2hh5hj946g77', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
   '/electronics/smartphones', '/electronics/smartphones', 'Smartphones', 'optimized', 85, 1, 1),
  ('h7llij66-6j7i-1lm5-ii3k-3ii6ik057h88', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
   '/electronics/audio', '/electronics/audio', 'Audio & Headphones', 'outdated', 65, 1, 2);

-- Insert sample templates
INSERT INTO templates (id, organization_id, name, type, description, template_content, variables, is_default, created_by)
VALUES 
  ('i8mmjk77-7k8j-2mn6-jj4l-4jj7jl168i99', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'Default Brand Description', 'brand', 'Standard template for brand category descriptions',
   '<h1>{{title}}</h1>\n<p>{{introduction}}</p>\n<h2>About {{brand_name}}</h2>\n<p>{{brand_description}}</p>\n<h2>Popular Products</h2>\n<ul>\n{{#each products}}\n  <li>{{this}}</li>\n{{/each}}\n</ul>',
   '["title", "introduction", "brand_name", "brand_description", "products"]',
   true, 'd0d4a9e0-7e3f-4d3a-8c6b-2e8c9f012345'),
   
  ('j9nnkl88-8l9k-3no7-kk5m-5kk8km279j00', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'Inspire Content Template', 'inspire', 'Template for inspirational content',
   '<article>\n<h1>{{headline}}</h1>\n<div class="hero">{{hero_text}}</div>\n<section>\n{{#each sections}}\n  <h2>{{title}}</h2>\n  <p>{{content}}</p>\n{{/each}}\n</section>\n<footer>{{call_to_action}}</footer>\n</article>',
   '["headline", "hero_text", "sections", "call_to_action"]',
   false, 'd0d4a9e0-7e3f-4d3a-8c6b-2e8c9f012345');

-- Insert sample content items
INSERT INTO content_items (id, project_id, taxonomy_node_id, type, language, status, title, content, version, created_by)
VALUES 
  ('k0oolm99-9m0l-4op8-ll6n-6ll9ln380k11', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
   'category', 'en', 'published', 'Electronics - Your Digital World',
   '{"html": "<h1>Electronics</h1><p>Discover the latest in technology...</p>", "meta_description": "Shop electronics at great prices", "keywords": ["electronics", "technology", "gadgets"]}',
   1, 'd0d4a9e0-7e3f-4d3a-8c6b-2e8c9f012345'),
   
  ('l1ppmn00-0n1m-5pq9-mm7o-7mm0mo491l22', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'f5jjgh44-4h5g-9jk3-gg1i-1gg4gi835f66',
   'brand', 'en', 'draft', 'Top Computer Brands',
   '{"html": "<h1>Computer Brands We Love</h1><p>From gaming to productivity...</p>", "featured_brands": ["Apple", "Dell", "HP", "Lenovo"]}',
   1, 'e1e5b0f1-8f4g-5e4b-9d7c-3f9d0g123456');

-- Insert sample generation queue items
INSERT INTO generation_queue (id, project_id, user_id, status, priority, config, created_at)
VALUES 
  ('m2qqno11-1o2n-6qr0-nn8p-8nn1np502m33', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'd0d4a9e0-7e3f-4d3a-8c6b-2e8c9f012345',
   'pending', 1,
   '{"type": "bulk", "content_type": "category", "node_ids": ["d3hhef22-2f3e-7hi1-ee9g-9ee2eg613d44", "e4iifg33-3g4f-8ij2-ff0h-0ff3fh724e55"], "language": "en", "template_id": "i8mmjk77-7k8j-2mn6-jj4l-4jj7jl168i99"}',
   NOW() - INTERVAL '2 hours'),
   
  ('n3rrop22-2p3o-7rs1-oo9q-9oo2oq613n44', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22', 'e1e5b0f1-8f4g-5e4b-9d7c-3f9d0g123456',
   'completed', 0,
   '{"type": "single", "content_type": "inspire", "node_id": "g6kkhi55-5i6h-0kl4-hh2j-2hh5hj946g77", "language": "en"}',
   NOW() - INTERVAL '1 day');

-- Update the completed generation queue item
UPDATE generation_queue 
SET 
  started_at = created_at + INTERVAL '5 minutes',
  completed_at = created_at + INTERVAL '15 minutes',
  result = '{"content_id": "generated-content-id", "word_count": 500, "model": "gpt-4"}'
WHERE id = 'n3rrop22-2p3o-7rs1-oo9q-9oo2oq613n44';

-- Add sample scraped content
INSERT INTO scraped_content (id, project_id, url, content_type, extracted_text, extracted_data, status, scraped_at)
VALUES 
  ('o4sspq33-3q4p-8st2-pp0r-0pp3pr724o55', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
   'https://example-shop.com/electronics', 'text/html',
   'Electronics Shop the latest electronics and technology products...',
   '{"title": "Electronics", "products_count": 450, "subcategories": ["Computers", "Smartphones", "Audio"]}',
   'success', NOW() - INTERVAL '3 days'),
   
  ('p5ttqr44-4r5q-9tu3-qq1s-1qq4qs835p66', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
   'https://example-shop.com/sitemap.xml', 'application/xml',
   NULL,
   '{"urls": ["/electronics", "/clothing", "/home-garden"], "total_pages": 1250}',
   'success', NOW() - INTERVAL '5 days');

-- Insert sample audit logs
INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, new_values, ip_address, created_at)
VALUES 
  ('d0d4a9e0-7e3f-4d3a-8c6b-2e8c9f012345', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'create', 'project', 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22',
   '{"name": "E-commerce Site", "domain": "example-shop.com"}',
   '192.168.1.1', NOW() - INTERVAL '7 days'),
   
  ('e1e5b0f1-8f4g-5e4b-9d7c-3f9d0g123456', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'update', 'content_item', 'l1ppmn00-0n1m-5pq9-mm7o-7mm0mo491l22',
   '{"status": "draft"}',
   '192.168.1.2', NOW() - INTERVAL '1 hour');