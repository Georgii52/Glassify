import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { S3Module } from './common/S3/s3.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlassesEntity } from './entities/glasses.entity';
import { ConfigModule } from '@nestjs/config';
import path from 'path';
import { AdminEntity } from './modules/auth/entities/user.entity';
import { AuthModule } from './modules/auth/auth.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // гарантированно берем .env из корня проекта glasses
      envFilePath: [path.resolve(__dirname, '..', '.env')],
    }),
    S3Module,
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      username: process.env.DB_USERNAME,
      // pg ожидает строку; если переменная не подтянулась, хотя бы не упадем на типе
      password: String(process.env.DB_PASSWORD ?? ''),
      database: process.env.DB_NAME,
      entities: [
        __dirname + '/**/*.entity{.ts,.js}',
        GlassesEntity,
        AdminEntity,
      ],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([GlassesEntity, AdminEntity]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
