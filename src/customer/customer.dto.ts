// customer.dto.ts
import { IsOptional, IsString, IsEmail, IsNumberString, IsInt, IsNumber } from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  ic?: string;  

  @IsOptional()
  @IsString()
  passport?: string;

  @IsOptional()
  @IsString()
  race?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  marital_status?: string;

  @IsOptional()
  @IsInt()
  no_of_child?: number;

  @IsOptional()
  @IsNumberString()
  mobile_no?: string;

  @IsOptional()
  @IsString()
  tel_code?: string;

  @IsOptional()
  @IsNumberString()
  tel_no?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  generate_id?: string;

  @IsOptional()
  @IsString()
  car_plate?: string;
  created_by: any;
}

export class UpdateCustomerDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  ic?: string;

  @IsOptional()
  @IsString()
  passport?: string;

  @IsOptional()
  @IsString()
  race?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  marital_status?: string;

  @IsOptional()
  @IsNumber()
  no_of_child?: number;

  @IsOptional()
  @IsNumberString()
  mobile_no?: string;

  @IsOptional()
  @IsString()
  tel_code?: string;

  @IsOptional()
  @IsNumberString()
  tel_no?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  car_plate?: string;
}