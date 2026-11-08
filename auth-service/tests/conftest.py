import os

# Lidas ao importar core/config.py e database/connection.py
os.environ.setdefault("SECRET_KEY", "segredo-de-teste-com-mais-de-32-bytes")
os.environ.setdefault("DATABASE_URL", "sqlite://")
