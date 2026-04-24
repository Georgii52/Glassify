import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateGlassesDto } from './dto/create-glasses.dto';
import { PatchGlassesDto } from './dto/patch-glasses.dto';
import type { Multer } from 'multer';
import { v4 as uuid } from 'uuid';
import { S3Service } from './common/S3/s3.service';
import { GlassesEntity } from './entities/glasses.entity';
import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AppService {
  constructor(
    private readonly s3Service: S3Service,
    @InjectRepository(GlassesEntity)
    private readonly glassesRepository: Repository<GlassesEntity>,
  ) {}

  async getGlasses(search?: string, page: number = 1, limit: number = 15) {
    const where = search?.trim() ? { name: ILike(`%${search.trim()}%`) } : {};
    const [data, total] = await this.glassesRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getGlassesById(id: string) {
    const glasses = await this.glassesRepository.findOneBy({ id });
    if (!glasses) throw new NotFoundException('Glasses not found');

    // На этом роуте возвращаем DTO + файл модели.
    // Так как это JSON-ответ, файл отдаём base64.
    const { buffer, contentType } = await this.s3Service.getCardPhotoBuffer(glasses.key);

    return {
      dto: {
        name: glasses.name,
        position: glasses.position,
        rotation: glasses.rotation,
        scale: glasses.scale,
      },
      file: {
        base64: buffer.toString('base64'),
        contentType,
      },
    };
  }

  async getModelFileById(id: string) {
    const glasses = await this.glassesRepository.findOneBy({ id });
    if (!glasses) throw new NotFoundException('Glasses not found');
    if (!glasses.key) throw new NotFoundException('Model file not found');

    const { buffer, contentType } = await this.s3Service.getCardPhotoBuffer(glasses.key);
    const fileName = `glasses-${id}`;

    return { buffer, contentType, fileName };
  }

  async addGlasses(dto: CreateGlassesDto, model?: Multer.File) {
    if (!model) throw new BadRequestException('Model is required');
    if (!dto?.name || typeof dto.name !== 'string' || !dto.name.trim()) {
      throw new BadRequestException('Name is required');
    }
    const key = `glasses/${uuid()}`;
    await this.s3Service.uploadCardPhoto(key, model.buffer, model.mimetype);
    const name = dto.name.trim();

    const position: [number, number, number] =
      Array.isArray(dto?.position) && dto.position.length === 3
        ? [Number(dto.position[0]) || 0, Number(dto.position[1]) || 0, Number(dto.position[2]) || 0]
        : [0, 0, 0];

    const rotation: [number, number, number, number] =
      Array.isArray(dto?.rotation) && dto.rotation.length === 4
        ? [
            Number(dto.rotation[0]) || 0,
            Number(dto.rotation[1]) || 0,
            Number(dto.rotation[2]) || 0,
            Number(dto.rotation[3]) || 0,
          ]
        : [0, 0, 0, 0];

    const scale: [number, number, number] =
      Array.isArray(dto?.scale) && dto.scale.length === 3
        ? [Number(dto.scale[0]) || 0, Number(dto.scale[1]) || 0, Number(dto.scale[2]) || 0]
        : [1, 1, 1];

    const newModel =  this.glassesRepository.create({
      key,
      name,
      position,
      rotation,
      scale,
    });
    await this.glassesRepository.save(newModel);
    return newModel;
  }

  async deleteGlassesById(id: string) {
    const glasses = await this.glassesRepository.findOneBy({ id });
    if (!glasses) throw new NotFoundException('Glasses not found');
    await this.s3Service.deleteCardPhoto(glasses.key);
    await this.glassesRepository.remove(glasses);
    return { id };
  }

  async patchGlassesById(id: string, dto: PatchGlassesDto) {
    const glasses = await this.glassesRepository.findOneBy({ id });
    if (!glasses) throw new NotFoundException('Glasses not found');

    if (dto?.name !== undefined) {
      glasses.name = dto.name.trim();
    }

    if (Array.isArray(dto?.position) && dto.position.length === 3) {
      glasses.position = [
        Number(dto.position[0]) || 0,
        Number(dto.position[1]) || 0,
        Number(dto.position[2]) || 0,
      ];
    }

    if (Array.isArray(dto?.rotation) && dto.rotation.length === 4) {
      glasses.rotation = [
        Number(dto.rotation[0]) || 0,
        Number(dto.rotation[1]) || 0,
        Number(dto.rotation[2]) || 0,
        Number(dto.rotation[3]) || 0,
      ];
    }

    if (Array.isArray(dto?.scale) && dto.scale.length === 3) {
      glasses.scale = [
        Number(dto.scale[0]) || 0,
        Number(dto.scale[1]) || 0,
        Number(dto.scale[2]) || 0,
      ];
    }

    await this.glassesRepository.save(glasses);
    return glasses;
  }
}
