"""Exercise legacy-data upgrades and downgrade/re-upgrade in a disposable schema."""
import os
import secrets
import subprocess
from datetime import datetime, timezone
import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url

url = os.environ.get("TEST_DATABASE_URL", "")
if not url.split("?")[0].endswith("/neighbourly_test"):
    raise RuntimeError("Migration checks require the disposable neighbourly_test database.")
schema = "migration_check_" + secrets.token_hex(6)
connection = psycopg.connect(url.replace("postgresql+psycopg://", "postgresql://"), autocommit=True)
connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
scoped_url = make_url(url).update_query_dict({"options": f"-csearch_path={schema}"}).render_as_string(hide_password=False)
env = {**os.environ, "DATABASE_URL": scoped_url, "APP_ENV": "development", "PAYMENT_PROVIDER": "development", "JWT_SECRET": "test-only-neighbourly-operations-secret"}


def migrate(*args):
    subprocess.run([".venv/bin/alembic", *args], env=env, check=True)


try:
    migrate("upgrade", "a1b2c3d4e5f6")
    connection.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
    timestamp = datetime.now(timezone.utc)
    connection.execute("INSERT INTO societies (id,name,address,created_at,updated_at) VALUES ('society','Legacy','Address',%s,%s)", (timestamp,timestamp))
    connection.execute("INSERT INTO users (id,phone,name,email,preferences,created_at,updated_at) VALUES ('user','+919000000001','Legacy','','{}',%s,%s)", (timestamp,timestamp))
    connection.execute("INSERT INTO buildings (id,society_id,name,created_at,updated_at) VALUES ('building','society','A',%s,%s)", (timestamp,timestamp))
    connection.execute("INSERT INTO units (id,society_id,building_id,number,created_at,updated_at) VALUES ('unit','society','building','101',%s,%s)", (timestamp,timestamp))
    connection.execute("INSERT INTO memberships (id,society_id,unit_id,user_id,role,active,created_at,updated_at) VALUES ('member','society','unit','user','Owner',true,%s,%s)", (timestamp,timestamp))
    connection.execute("INSERT INTO notifications (id,society_id,user_id,title,body,category,route,created_at,updated_at) VALUES ('notification','society','user','Old','Old','Visitors','/visitors',%s,%s)", (timestamp,timestamp))
    migrate("upgrade", "head")
    assert connection.execute("SELECT name,settings FROM societies WHERE id='society'").fetchone() == ("Legacy", {})
    assert connection.execute("SELECT receives_visitors FROM memberships WHERE id='member'").fetchone() == (True,)
    assert connection.execute("SELECT push_state FROM notifications WHERE id='notification'").fetchone() == ("Skipped",)
    migrate("check")
    migrate("downgrade", "a1b2c3d4e5f6")
    assert connection.execute("SELECT name FROM societies WHERE id='society'").fetchone() == ("Legacy",)
    migrate("upgrade", "head")
    print("Legacy-data upgrade, schema comparison, downgrade and re-upgrade passed.")
finally:
    connection.execute("SET search_path TO public")
    connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))
    connection.close()
