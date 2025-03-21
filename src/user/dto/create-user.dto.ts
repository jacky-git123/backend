import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'AGENT', description: 'User role (default: AGENT)' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ example: 'supervisor_id', description: 'Supervisor ID' })
  @IsString()
  @IsOptional()
  supervisor?: string;

  @ApiProperty({ example: 'ACTIVE', description: 'User status' })
  @IsString()
  @IsOptional()
  status?: string;
}
