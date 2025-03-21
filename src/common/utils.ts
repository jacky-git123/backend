import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class RunningNumberGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniqueNumber(category: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear() % 100;

    // Check if a record exists for this category, year, and month
    let record = await this.prisma.tracker.findFirst({
      where: { category, year },
    });

    let newNumber = 1; // Default if no record exists

    if (record) {
      newNumber = record.lastNumber + 1; // Corrected field name
      // Update the last number
      await this.prisma.tracker.update({
        where: { id: record.id },
        data: { lastNumber: newNumber }, // Corrected field name
      });
    } else {
      // Insert new record for the month
      await this.prisma.tracker.create({
        data: { category, year, lastNumber: newNumber },
      });
    }

    // Format running number to 5 digits
    const formattedNumber = String(newNumber).padStart(5, '0');

    return `${category.toUpperCase()}${year}${formattedNumber}`;
  }
}
