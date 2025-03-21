import { Controller, Get, Query } from '@nestjs/common';
import { CountryService } from './country.service';
import { GetCountriesDto } from './countries.dto';

@Controller('country')
export class CountryController {
	constructor(private readonly countryService: CountryService) {}

  @Get()
  async getCountries(@Query() query: GetCountriesDto) {
		const { countryId, name } = query;
    return this.countryService.getCountries(countryId, name);
  }
}
