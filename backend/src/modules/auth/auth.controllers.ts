import { Body, Controller, Get, Post, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreateAdminDto } from "./dto/createAdmin.dto";
import { AuthService } from "./auth.service";
import { LoginAdminDto } from "./dto/loginAdmin.dto";

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() createAdminDto: CreateAdminDto) {
        return await this.authService.createAdmin(createAdminDto)
    }

    @Post('login')
    async login(@Body() loginAdminDto: LoginAdminDto) {
        return await this.authService.login(loginAdminDto)
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('me')
    me(@Request() req) {
        return req.user;
    }
}