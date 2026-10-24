import { Sequelize } from 'sequelize';
import { OneTimeTokenModel } from './models/one-time-token.model.js';
import { SessionModel } from './models/session.model.js';
import { UserModel } from './models/user.model.js';

/** Connects to Postgres and binds the models. Does not create tables: migrations do. */
export function createDatabase(url: string): Sequelize {
  const sequelize = new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    // camelCase attributes ⇄ snake_case columns, with created_at/updated_at (STYLE_GUIDE §9).
    define: { underscored: true, timestamps: true },
    pool: { max: 10, idle: 10_000 },
  });

  UserModel.initialize(sequelize);
  SessionModel.initialize(sequelize);
  OneTimeTokenModel.initialize(sequelize);

  return sequelize;
}
