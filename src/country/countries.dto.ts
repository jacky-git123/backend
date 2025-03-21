import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GetCountriesDto {
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @IsString()
  name?: string;
}