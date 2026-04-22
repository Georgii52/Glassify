import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controllers";
import { AuthService } from "./auth.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminEntity } from "./entities/user.entity";
import { JwtStrategy } from "src/strategies/jwt.strategy";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [
        // ConfigModule уже глобальный, но добавляем зависимость явно для корректной работы JwtStrategy
        ConfigModule,
        TypeOrmModule.forFeature([AdminEntity]),
        JwtModule.register({
            // fallback на случай отсутствия переменной окружения
            secret: process.env.JWT_SECRET || 'DEV_JWT_SECRET',
            signOptions: { expiresIn: '8h' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService],
})
export class AuthModule {}