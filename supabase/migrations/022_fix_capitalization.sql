-- Fix capitalization issues in existing taxonomy nodes
-- This will properly capitalize Swedish words

UPDATE taxonomy_nodes
SET title = 
  CASE 
    -- Specific Swedish words that were incorrectly capitalized
    WHEN title LIKE '%MöBler%' THEN REPLACE(title, 'MöBler', 'Möbler')
    WHEN title LIKE '%StöRre%' THEN REPLACE(title, 'StöRre', 'Större')
    WHEN title LIKE '%FöR%' AND title NOT LIKE 'För %' THEN REPLACE(title, 'FöR', 'För')
    WHEN title LIKE '%PåSar%' THEN REPLACE(title, 'PåSar', 'Påsar')
    WHEN title LIKE '%BläCk%' THEN REPLACE(title, 'BläCk', 'Bläck')
    WHEN title LIKE '%TväTt%' THEN REPLACE(title, 'TväTt', 'Tvätt')
    WHEN title LIKE '%KöK%' THEN REPLACE(title, 'KöK', 'Kök')
    WHEN title LIKE '%StäDning%' THEN REPLACE(title, 'StäDning', 'Städning')
    ELSE title
  END
WHERE title ~ '[åäöÅÄÖ]' -- Only update rows with Swedish characters
  AND (
    title LIKE '%MöBler%' OR
    title LIKE '%StöRre%' OR
    title LIKE '%FöR%' OR
    title LIKE '%PåSar%' OR
    title LIKE '%BläCk%' OR
    title LIKE '%TväTt%' OR
    title LIKE '%KöK%' OR
    title LIKE '%StäDning%'
  );

-- Show a sample of updated titles
SELECT id, title, path 
FROM taxonomy_nodes 
WHERE title ~ '[åäöÅÄÖ]'
ORDER BY path
LIMIT 20;