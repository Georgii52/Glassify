import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // читаем секрет из env через ConfigService с запасным значением
      secretOrKey: configService.get<string>('JWT_SECRET', 'DEV_JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // то, что вернётся отсюда, попадёт в request.user
    return { id: payload.sub, login: payload.login };
  }
}