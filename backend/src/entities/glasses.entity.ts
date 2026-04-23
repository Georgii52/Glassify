import {
    CreateDateColumn,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    Entity,
    Column
} from 'typeorm';
import { MainEntity } from './main.entity';

@Entity()
export class GlassesEntity extends MainEntity {
    @Column()
    key: string;

    @Column()
    name: string;

    @Column({ type: 'jsonb' })
    position: [number, number, number];

    @Column({ type: 'jsonb' })
    rotation: [number, number, number, number];

    @Column({ type: 'jsonb' })
    scale: [number, number, number];
}
