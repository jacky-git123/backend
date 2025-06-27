import { IsString, IsOptional, IsUUID, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateExpenseDto {
  @IsNotEmpty()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  jan?: string;

  @IsOptional()
  @IsString()
  feb?: string;

  @IsOptional()
  @IsString()
  mar?: string;

  @IsOptional()
  @IsString()
  apr?: string;

  @IsOptional()
  @IsString()
  may?: string;

  @IsOptional()
  @IsString()
  jun?: string;

  @IsOptional()
  @IsString()
  jul?: string;

  @IsOptional()
  @IsString()
  aug?: string;

  @IsOptional()
  @IsString()
  sep?: string;

  @IsOptional()
  @IsString()
  oct?: string;

  @IsOptional()
  @IsString()
  nov?: string;

  @IsOptional()
  @IsString()
  dec?: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @IsUUID()
  created_by?: string;

  @IsOptional()
  @IsUUID()
  updated_by?: string;
}
