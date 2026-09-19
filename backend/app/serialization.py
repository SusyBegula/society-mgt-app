from sqlalchemy import inspect, func, select


def public(record, exclude=()):
    return {column.key: getattr(record, column.key) for column in inspect(record).mapper.column_attrs if column.key not in exclude}


def page(db, query, offset=0, limit=30, exclude=()):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {"items": [public(row, exclude) for row in db.scalars(query.offset(offset).limit(limit))], "total": total, "offset": offset, "limit": limit}
