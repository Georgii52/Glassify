import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AdminEntity } from "./entities/user.entity";
import { Repository } from "typeorm";
import { CreateAdminDto } from "./dto/createAdmin.dto";
import * as bcrypt from 'bcryptjs';
import { JwtService } from "@nestjs/jwt";
import { LoginAdminDto } from "./dto/loginAdmin.dto";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(AdminEntity)
        private readonly adminRepository: Repository<AdminEntity>,
        private readonly jwtService: JwtService,
    ) { }


    async createAdmin(createAdminDto: CreateAdminDto) {
        const hashedPassword = await bcrypt.hash(createAdminDto.password, 10)
        const admin = this.adminRepository.create({
            ...createAdminDto,
            password: hashedPassword
        })
        return await this.adminRepository.save(admin)
    }

    async login(loginDto: LoginAdminDto) {
        const admin = await this.adminRepository.findOne({ where: { login: loginDto.login } })


        if (!admin) throw new UnauthorizedException('Неверный логин или пароль');

        const isPasswordValid = await bcrypt.compare(loginDto.password, admin.password)

        if (!isPasswordValid) {
            throw new UnauthorizedException('Неверный логин или пароль');
          }

        const payload = { sub: admin.id, login: admin.login }
        const accessToken = this.jwtService.sign(payload)

        return {id: admin.id, accessToken}
    }
}