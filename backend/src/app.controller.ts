import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateGlassesDto } from './dto/create-glasses.dto';
import { PatchGlassesDto } from './dto/patch-glasses.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';

@Controller('glasses')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getGlasses(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.appService.getGlasses(
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 9,
      sort,
    );
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

  @Patch(':id')
  async patchGlassesById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchGlassesDto,
  ) {
    return this.appService.patchGlassesById(id, dto);
  }

  @Delete(':id')
  async deleteGlassesById(@Param('id', ParseUUIDPipe) id: string) {
    return this.appService.deleteGlassesById(id);
  }
}
