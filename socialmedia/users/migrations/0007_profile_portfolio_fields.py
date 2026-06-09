from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_fix_default_profile_picture_paths'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='headline',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='profile',
            name='location',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='profile',
            name='website',
            field=models.URLField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='profile',
            name='skills',
            field=models.CharField(blank=True, default='', max_length=180),
        ),
    ]
