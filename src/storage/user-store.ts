/**
 * File-based user storage (JSON)
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/types';

export class UserStore {
  private usersDir: string;

  constructor(usersDir: string) {
    this.usersDir = usersDir;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.usersDir)) {
      fs.mkdirSync(this.usersDir, { recursive: true });
    }
  }

  private getUserFilePath(userId: string): string {
    return path.join(this.usersDir, `${userId}.json`);
  }

  private getUserFilePathByUsername(username: string): string {
    // Find user file by scanning directory
    const files = fs.readdirSync(this.usersDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.usersDir, file);
        try {
          const user = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as User;
          if (user.username.toLowerCase() === username.toLowerCase()) {
            return filePath;
          }
        } catch (error) {
          // Skip invalid files
          continue;
        }
      }
    }
    return '';
  }

  async createUser(username: string): Promise<User> {
    // Check if username already exists
    const existing = await this.getUserByUsername(username);
    if (existing) {
      throw new Error(`Username "${username}" already exists`);
    }

    const user: User = {
      id: uuidv4(),
      username,
      currentLevel: 1,
      maxLevelUnlocked: 1,
      totalAttempts: 0,
      successfulBreaches: 0,
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString()
    };

    const filePath = this.getUserFilePath(user.id);
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), 'utf-8');
    
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    const filePath = this.getUserFilePath(userId);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as User;
    } catch (error) {
      console.error(`Error reading user file: ${error}`);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const filePath = this.getUserFilePathByUsername(username);
    
    if (!filePath) {
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as User;
    } catch (error) {
      console.error(`Error reading user file: ${error}`);
      return null;
    }
  }

  async updateUser(user: User): Promise<void> {
    const filePath = this.getUserFilePath(user.id);
    user.lastPlayedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2), 'utf-8');
  }

  async getAllUsers(): Promise<User[]> {
    const files = fs.readdirSync(this.usersDir);
    const users: User[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.usersDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          users.push(JSON.parse(data) as User);
        } catch (error) {
          // Skip invalid files
          continue;
        }
      }
    }

    return users;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const filePath = this.getUserFilePath(userId);
    
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting user file: ${error}`);
      return false;
    }
  }
}

