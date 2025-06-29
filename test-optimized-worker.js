// Тест локального запуска оптимизированного worker
require('dotenv').config();

const config = require('./optimized-config');
const { readUsers } = require('./services/users');
const { OptimizedLightPhoneService } = require('./services/lightphone-optimized');

async function testOptimizedWorker() {
    console.log('🧪 Тестирование оптимизированного worker локально...');
    
    // Проверяем конфигурацию
    console.log('\n📊 Конфигурация:');
    console.log(`  • Базовый интервал: ${Math.round(config.intervals.base / 1000 / 60)} минут`);
    console.log(`  • Ускоренный режим: ${Math.round(config.intervals.accelerated / 1000 / 60)} минут`);
    console.log(`  • Ночной режим: ${Math.round(config.intervals.night / 1000 / 60)} минут`);
    console.log(`  • Puppeteer headless: ${config.puppeteer.launchOptions.headless}`);
    
    // Проверяем пользователей
    const allUsers = readUsers();
    console.log(`\n👥 Всего пользователей: ${allUsers.length}`);
    
    const activeUsers = allUsers.filter(u => 
        u.settings?.lightPhoneEmail && 
        u.settings?.lightPhonePassword &&
        process.env.CLAUDE_API_KEY
    );
    
    console.log(`👤 Активных пользователей: ${activeUsers.length}`);
    
    if (activeUsers.length === 0) {
        console.log('\n❌ Нет активных пользователей для тестирования');
        console.log('📝 Убедитесь что:');
        console.log('   1. В data/users.json есть пользователи с настройками lightPhoneEmail и lightPhonePassword');
        console.log('   2. Установлена переменная окружения CLAUDE_API_KEY');
        console.log('\n💡 Создайте тестового пользователя: node create-test-user.js');
        return;
    }
    
    // Проверяем переменные окружения
    console.log('\n🔑 Переменные окружения:');
    console.log(`  • CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? '✅ установлен' : '❌ не установлен'}`);
    console.log(`  • NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  • OPTIMIZED_MODE: ${process.env.OPTIMIZED_MODE || 'не установлен'}`);
    
    if (!process.env.CLAUDE_API_KEY) {
        console.log('\n❌ CLAUDE_API_KEY не установлен в переменных окружения');
        console.log('📝 Добавьте в файл .env: CLAUDE_API_KEY=your_key_here');
        return;
    }
    
    // Тестируем сервис Light Phone
    console.log('\n🚀 Тестирование OptimizedLightPhoneService...');
    const service = new OptimizedLightPhoneService(config.puppeteer);
    
    try {
        console.log('📱 Инициализация сервиса...');
        await service.initialize();
        console.log('✅ Сервис инициализирован');
        
        // Берем первого активного пользователя для теста
        const testUser = activeUsers[0];
        console.log(`\n🧪 Тестирование с пользователем: ${testUser.email}`);
        
        // Добавляем Claude API ключ
        if (!testUser.settings.claudeApiKey) {
            testUser.settings.claudeApiKey = process.env.CLAUDE_API_KEY;
        }
        
        console.log('🔍 Проверка заметок...');
        const startTime = Date.now();
        
        const result = await service.checkNotes(testUser);
        
        const duration = Date.now() - startTime;
        
        console.log(`\n📊 Результат проверки (${duration}ms):`);
        console.log(`  • Успешно: ${result.success ? '✅' : '❌'}`);
        console.log(`  • Найдено заметок: ${result.notes ? result.notes.length : 0}`);
        console.log(`  • Обработано: ${result.processedCount || 0}`);
        console.log(`  • Ошибки: ${result.errors.length}`);
        
        if (result.notes && result.notes.length > 0) {
            console.log('\n📋 Заметки:');
            result.notes.forEach((note, index) => {
                const status = note.needsProcessing ? '🔥 требует обработки' : '📝 обычная';
                console.log(`  ${index + 1}. ${note.title.substring(0, 50)}... (${status})`);
            });
        }
        
        if (result.errors.length > 0) {
            console.log('\n❌ Ошибки:');
            result.errors.forEach(error => {
                console.log(`  • ${error}`);
            });
        }
        
        if (result.error) {
            console.log(`\n💥 Основная ошибка: ${result.error}`);
        }
        
        // Статистика памяти
        if (result.memoryUsage) {
            const rss = Math.round(result.memoryUsage.rss / 1024 / 1024);
            const heap = Math.round(result.memoryUsage.heapUsed / 1024 / 1024);
            console.log(`\n💾 Использование памяти: RSS ${rss}MB, Heap ${heap}MB`);
        }
        
    } catch (error) {
        console.error('\n💥 Ошибка тестирования:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🧹 Очистка...');
        await service.cleanup();
    }
    
    console.log('\n✅ Тест завершен!');
    
    if (activeUsers.length > 0) {
        console.log('\n🚀 Для запуска полного worker используйте:');
        console.log('   npm run start:optimized');
        console.log('\n🌐 Для Railway деплоя установите переменные:');
        console.log('   OPTIMIZED_MODE=true');
        console.log('   CLAUDE_API_KEY=your_key_here');
    }
}

if (require.main === module) {
    testOptimizedWorker().catch(console.error);
}

module.exports = { testOptimizedWorker }; 