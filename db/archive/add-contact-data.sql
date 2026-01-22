-- /db/archive/add-contact-data.sql
-- =====================================================
-- Additional Contact Info & Addresses
-- Western Washington locations with real towns/zips
-- =====================================================

BEGIN;

-- Get the org_id (Mountain Vineyard)
DO $$
DECLARE
  v_org_id uuid := 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid;
  v_amy_id uuid;
  v_bob_id uuid;
  v_brian_id uuid;
  v_chris_id uuid;
  v_dash_id uuid;
  v_heather_id uuid;
  v_james_id uuid;
  v_emily1_id uuid;
  v_emily2_id uuid;
BEGIN
  -- Get person IDs
  SELECT id INTO v_amy_id FROM people WHERE org_id = v_org_id AND display_name = 'Amy White';
  SELECT id INTO v_bob_id FROM people WHERE org_id = v_org_id AND display_name = 'Bob';
  SELECT id INTO v_brian_id FROM people WHERE org_id = v_org_id AND display_name = 'Brian Wikene';
  SELECT id INTO v_chris_id FROM people WHERE org_id = v_org_id AND display_name = 'Chris Thompson';
  SELECT id INTO v_dash_id FROM people WHERE org_id = v_org_id AND display_name = 'David "Dash" Ritchie';
  SELECT id INTO v_heather_id FROM people WHERE org_id = v_org_id AND display_name = 'Heather Wikene';
  SELECT id INTO v_james_id FROM people WHERE org_id = v_org_id AND display_name = 'James Wilson';
  
  -- Get Emily Rodriguez IDs (there are two)
  SELECT id INTO v_emily1_id FROM people WHERE org_id = v_org_id AND display_name = 'Emily Rodriguez' LIMIT 1;

  -- ==========================================
  -- AMY WHITE - Just email and social media
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_amy_id, 'email_personal', 'amy.white@gmail.com', 'Personal', true),
    (v_org_id, v_amy_id, 'social_instagram', '@amywhite', 'Instagram', false);

  -- ==========================================
  -- BOB - Just phone (mobile)
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_bob_id, 'phone_mobile', '(253) 555-0142', 'Mobile', true);

  -- ==========================================
  -- BRIAN WIKENE - Multiple of everything
  -- Auburn, WA address
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_brian_id, 'phone_mobile', '(253) 555-0198', 'Mobile', true),
    (v_org_id, v_brian_id, 'phone_home', '(253) 555-0199', 'Home', false),
    (v_org_id, v_brian_id, 'email_personal', 'brian.wikene@gmail.com', 'Personal', true),
    (v_org_id, v_brian_id, 'email_work', 'bwikene@vineyard.org', 'Work', false),
    (v_org_id, v_brian_id, 'social_facebook', 'brian.wikene', 'Facebook', false),
    (v_org_id, v_brian_id, 'social_instagram', '@brianwikene', 'Instagram', false);

  INSERT INTO addresses (org_id, person_id, street, city, state, postal_code, label)
  VALUES
    (v_org_id, v_brian_id, '2847 Hemlock Street NE', 'Auburn', 'WA', '98002', 'Home');

  -- ==========================================
  -- CHRIS THOMPSON - Email, phone, address
  -- Tacoma, WA
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_chris_id, 'phone_mobile', '(253) 555-0175', 'Mobile', true),
    (v_org_id, v_chris_id, 'email_personal', 'chris.t@outlook.com', 'Personal', true);

  INSERT INTO addresses (org_id, person_id, street, city, state, postal_code, label)
  VALUES
    (v_org_id, v_chris_id, '1423 South Pine Street', 'Tacoma', 'WA', '98405', 'Home');

  -- ==========================================
  -- DAVID "DASH" RITCHIE - Social media only
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_dash_id, 'social_twitter', '@dashritchie', 'Twitter/X', true),
    (v_org_id, v_dash_id, 'social_instagram', '@dash.ritchie', 'Instagram', false);

  -- ==========================================
  -- HEATHER WIKENE - Phone, email, address
  -- Auburn, WA (same as Brian)
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_heather_id, 'phone_mobile', '(253) 555-0197', 'Mobile', true),
    (v_org_id, v_heather_id, 'phone_home', '(253) 555-0199', 'Home', false),
    (v_org_id, v_heather_id, 'email_personal', 'heather.wikene@gmail.com', 'Personal', true);

  INSERT INTO addresses (org_id, person_id, street, city, state, postal_code, label)
  VALUES
    (v_org_id, v_heather_id, '2847 Hemlock Street NE', 'Auburn', 'WA', '98002', 'Home');

  -- ==========================================
  -- JAMES WILSON - Work and personal contact
  -- Bellevue, WA
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_james_id, 'phone_mobile', '(425) 555-0188', 'Mobile', true),
    (v_org_id, v_james_id, 'phone_work', '(425) 555-0300', 'Work', false),
    (v_org_id, v_james_id, 'email_personal', 'james.wilson@gmail.com', 'Personal', true),
    (v_org_id, v_james_id, 'email_work', 'jwilson@techcorp.com', 'Work', false),
    (v_org_id, v_james_id, 'social_linkedin', 'jameswilson', 'LinkedIn', false);

  INSERT INTO addresses (org_id, person_id, street, city, state, postal_code, label)
  VALUES
    (v_org_id, v_james_id, '14523 NE 8th Street', 'Bellevue', 'WA', '98007', 'Home'),
    (v_org_id, v_james_id, '500 110th Avenue NE', 'Bellevue', 'WA', '98004', 'Work');

  -- ==========================================
  -- EMILY RODRIGUEZ (first one) - Multiple phones
  -- Kent, WA
  -- ==========================================
  INSERT INTO contact_methods (org_id, person_id, type, value, label, is_primary)
  VALUES
    (v_org_id, v_emily1_id, 'phone_mobile', '(253) 555-0156', 'Mobile', true),
    (v_org_id, v_emily1_id, 'phone_home', '(253) 555-0157', 'Home', false),
    (v_org_id, v_emily1_id, 'email_personal', 'emily.rodriguez@yahoo.com', 'Personal', true),
    (v_org_id, v_emily1_id, 'social_facebook', 'emily.rodriguez', 'Facebook', false);

  INSERT INTO addresses (org_id, person_id, street, city, state, postal_code, label)
  VALUES
    (v_org_id, v_emily1_id, '9842 SE 256th Street', 'Kent', 'WA', '98030', 'Home');

END $$;

COMMIT;

-- Verify additions
SELECT 
  p.display_name,
  COUNT(DISTINCT cm.id) as contact_methods,
  COUNT(DISTINCT a.id) as addresses
FROM people p
LEFT JOIN contact_methods cm ON cm.person_id = p.id
LEFT JOIN addresses a ON a.person_id = p.id
WHERE p.org_id = 'a8c2c7ab-836a-4ef1-a373-562e20babb76'::uuid
GROUP BY p.id, p.display_name
ORDER BY p.display_name;
