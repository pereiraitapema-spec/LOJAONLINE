const fs = require('fs');
const file = 'src/pages/Settings.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.split("alter table public.orders add column tracking_code text;").join("alter table public.orders add column tracking_code text;\n    end if;\n    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'shipping_label_url') then\n        alter table public.orders add column shipping_label_url text;");
fs.writeFileSync(file, content);
