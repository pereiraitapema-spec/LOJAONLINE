console.log('Environment Variables Keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('KEY') || k.includes('SECRET')));
