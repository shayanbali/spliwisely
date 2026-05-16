from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0006_group_group_type_pottransaction'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='approval_threshold',
            field=models.DecimalField(decimal_places=2, default=50, max_digits=10),
        ),
    ]
