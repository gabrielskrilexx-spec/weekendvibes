from pathlib import Path
p=Path('drizzle/schema.ts')
s=p.read_text()
s=s.replace('from "drizzle-orm/mysql-core"','from "drizzle-orm/pg-core"')
s=s.replace('mysqlTable','pgTable').replace('mysqlEnum','pgEnum')
s=s.replace('index, int, pgEnum, pgTable, text, timestamp, varchar, uniqueIndex','index, integer, pgEnum, pgTable, serial, text, timestamp, varchar, uniqueIndex')
s=s.replace('index, int, pgEnum, pgTable, text, timestamp, varchar, uniqueIndex','index, integer, pgEnum, pgTable, serial, text, timestamp, varchar, uniqueIndex')
s=s.replace('int, pgEnum','integer, pgEnum')
# serial is the PostgreSQL equivalent of an auto-incrementing integer primary key.
import re
s=re.sub(r'int\("([^"]+)"\)\.autoincrement\(\)\.primaryKey\(\)', r'serial("\1").primaryKey()', s)
s=re.sub(r'int\("([^"]+)"\)', r'integer("\1")', s)
# PostgreSQL has no MySQL onUpdateNow column builder; application writes updatedAt explicitly.
s=s.replace('.defaultNow().onUpdateNow().notNull()', '.defaultNow().notNull()')
p.write_text(s)
PY
cd /home/ubuntu/weekendvibes && python3 scripts/convert-schema-to-postgres.py && sed -n '1,25p' drizzle/schema.ts && rg -n 'mysql|autoincrement|onUpdateNow|int\(' drizzle/schema.ts || true