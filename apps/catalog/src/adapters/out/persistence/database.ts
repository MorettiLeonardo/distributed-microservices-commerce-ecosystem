import { Sequelize } from 'sequelize';

/** Connects to Postgres. Models are bound here as they are added; migrations create the tables. */
export function createDatabase(url: string): Sequelize {
  return new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    // camelCase attributes ⇄ snake_case columns, with created_at/updated_at (STYLE_GUIDE §9).
    define: { underscored: true, timestamps: true },
    pool: { max: 10, idle: 10_000 },
  });
}
