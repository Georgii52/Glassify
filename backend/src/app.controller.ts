import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateGlassesDto } from './dto/create-glasses.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';

@Controller('glasses')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getGlasses() {
    return this.appService.getGlasses();
  }

  @Get(':id')
  async getGlassesById(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.getGlassesById(id);
  }

  // Возвращает файл модели по id вместо ссылки (S3 -> bytes -> StreamableFile)
  @Get(':id/model')
  async getModel(@Param('id', ParseUUIDPipe) id: string) {
    const { buffer, contentType } = await this.appService.getModelFileById(id);
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: 'inline',
    });
  }

  @Post()
  @UseInterceptors(FileInterceptor('model'))
  async addGlasses(
    @Body() glassesDto: CreateGlassesDto,
    @UploadedFile() model: Multer.File,
  ) {
    return this.appService.addGlasses(glassesDto, model);
  }

  // Обновляет все параметры очков (position/rotation/scale) по id
  @Patch(':id')
  async patchGlassesById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateGlassesDto,
  ) {
    return this.appService.patchGlassesById(id, dto);
  }

  @Delete(':id')
  async deleteGlassesById(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.deleteGlassesById(id);
  }
}
