import { MainEntity } from "src/entities/main.entity";
import { Column, Entity } from "typeorm";

@Entity('admins')
export class AdminEntity extends MainEntity{
    
    @Column({unique: true})
    login: string

    @Column()
    password: string
}