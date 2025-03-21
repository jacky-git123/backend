import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class CountryService {
	constructor(private prisma: PrismaService) { }

	async getCountries(countryId?: string, name?: string) {
		const where = {};
		if (countryId) where['id'] = countryId;
		if (name) where['name'] = name;

		return this.prisma.country.findMany({
			where,
			include: {
				states: {
					include: {
						cities: true,
					},
				},
			},
		});
	}
}
