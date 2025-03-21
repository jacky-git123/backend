// src/company/dto/create-company.dto.ts
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCompanyDto {
  @IsOptional()
  @IsString()
  annual_income?: string;

  @IsOptional()
  @IsString()
  business_type?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  employee_no?: string;

  @IsOptional()
  @IsString()
  employee_type?: string;

  @IsOptional()
  @IsString()
  income_date?: string;

  @IsOptional()
  @IsString()
  income_type?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  occupation_category?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  tel_code?: string;

  @IsOptional()
  @IsString()
  tel_no?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;
}