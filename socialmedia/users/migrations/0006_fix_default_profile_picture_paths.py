from django.db import migrations, models


def fix_default_profile_picture_paths(apps, schema_editor):
    Profile = apps.get_model('users', 'Profile')
    Profile.objects.filter(profile_pic='default.png').update(
        profile_pic='profile_pics/default.png'
    )
    Profile.objects.filter(profile_pic='').update(
        profile_pic='profile_pics/default.png'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_create_missing_profiles'),
    ]

    operations = [
        migrations.AlterField(
            model_name='profile',
            name='profile_pic',
            field=models.ImageField(blank=True, default='profile_pics/default.png', upload_to='profile_pics/'),
        ),
        migrations.RunPython(fix_default_profile_picture_paths, migrations.RunPython.noop),
    ]
