from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0007_add_category_to_expense'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='status',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('approved', 'Approved'),
                    ('pending',  'Pending Approval'),
                    ('rejected', 'Rejected'),
                ],
                default='approved',
            ),
        ),
        migrations.CreateModel(
            name='ExpenseApproval',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('approved', models.BooleanField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expense', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='approvals',
                    to='expenses.expense',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='expense_approvals',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'unique_together': {('expense', 'user')}},
        ),
    ]
