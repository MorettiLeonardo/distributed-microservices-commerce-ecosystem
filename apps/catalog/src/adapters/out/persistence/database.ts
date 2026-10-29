import { Sequelize } from 'sequelize';
import { CategoryModel } from './models/category.model.js';

/** Connects to Postgres and binds the models. Does not create tables: migrations do. */
export function createDatabase(url: string): Sequelize {
  const sequelize = new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    // camelCase attributes ⇄ snake_case columns, with created_at/updated_at (STYLE_GUIDE §9).
    define: { underscored: true, timestamps: true },
    pool: { max: 10, idle: 10_000 },
  });

  CategoryModel.initialize(sequelize);

  return sequelize;
}
