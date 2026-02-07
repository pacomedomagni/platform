import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class UpsertStorePageDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
