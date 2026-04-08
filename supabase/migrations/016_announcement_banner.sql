-- @마이그레이션: 016_announcement_banner
-- @설명: 공지 배너 콘텐츠 (front_content 테이블에 기본값 삽입)

INSERT INTO front_content (key, value) VALUES
  ('banner_text',        'Introducing GeniePost — AI-powered WordPress posting, starting at $9/month.'),
  ('banner_text_mobile', 'GeniePost is here — AI WordPress posting from $9/mo.'),
  ('banner_link_text',   'Learn more →'),
  ('banner_link_url',    '#product'),
  ('banner_visible',     'true')
ON CONFLICT (key) DO NOTHING;
