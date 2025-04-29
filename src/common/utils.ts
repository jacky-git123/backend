import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class RunningNumberGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniqueNumber(category: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear() % 100;
  
    // Retry the operation if we detect a concurrent modification
    const MAX_RETRIES = 5;
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        return await this.prisma.$transaction(async (prisma) => {
          // Find the current record
          const record = await prisma.tracker.findFirst({
            where: { category, year },
          });
  
          let newNumber = 1; // Default if no record exists
  
          if (record) {
            newNumber = record.lastNumber + 1;
            
            // Update with a version check to detect concurrent modifications
            const updated = await prisma.tracker.updateMany({
              where: { 
                id: record.id,
                lastNumber: record.lastNumber // Ensures no one else updated it
              },
              data: { lastNumber: newNumber }
            });
            
            // If no rows were updated, someone else modified the record
            if (updated.count === 0) {
              throw new Error('Concurrent modification detected');
            }
          } else {
            // Create a new record (this is naturally atomic)
            await prisma.tracker.create({
              data: { category, year, lastNumber: newNumber }
            });
          }
  
          // Format running number to 5 digits
          const formattedNumber = String(newNumber).padStart(5, '0');
  
          return `${category.toUpperCase()}${year}${formattedNumber}`;
        });
      } catch (error) {
        retries++;
        // If we've hit the retry limit, rethrow the error
        if (retries >= MAX_RETRIES) {
          throw new Error(`Failed to generate unique number after ${MAX_RETRIES} attempts: ${error.message}`);
        }
        // Otherwise wait briefly and retry
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  generateRandomNumber(prefix: string): string {
    return `${prefix}${Math.floor(Math.random() * 900000 + 100000).toString().toUpperCase()}`;
  }
}
